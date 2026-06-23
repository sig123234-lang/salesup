import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

async function ensureAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  clientId: string,
): Promise<'ok' | 'not_found' | 'forbidden'> {
  const { data, error } = await supabase
    .from('clients')
    .select('owner_id, company_id')
    .eq('id', clientId)
    .single()
  if (error || !data) return 'not_found'
  if (data.owner_id === userId) return 'ok'
  // company-shared read access
  if (data.company_id) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', userId)
      .single()
    if (prof?.company_id === data.company_id) return 'ok'
  }
  return 'forbidden'
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: clientId } = await ctx.params
  const access = await ensureAccess(supabase, user.id, clientId)
  if (access === 'not_found') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (access === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10) || 20, 50)
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') ?? '0', 10) || 0)

  const [actsRes, callsRes, visitsRes] = await Promise.all([
    supabase
      .from('activities')
      .select('id, type, content, metadata, created_at, user:profiles(full_name, avatar_url)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1),
    supabase
      .from('call_records')
      .select('id, analysis, transcript, duration_seconds, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('visit_records')
      .select('id, analysis, started_at, ended_at')
      .eq('client_id', clientId)
      .order('started_at', { ascending: false })
      .limit(50),
  ])

  const callsById = new Map<string, { id: string; created_at: string }>()
  for (const c of callsRes.data ?? []) {
    callsById.set(c.id as string, {
      id: c.id as string,
      created_at: c.created_at as string,
    })
  }

  const callsByTime = (callsRes.data ?? []).slice()
  const visitsByTime = (visitsRes.data ?? []).slice()

  function attachCallForActivity(activityCreatedAt: string, metadata: unknown) {
    const meta = (metadata ?? {}) as Record<string, unknown>
    const directId = typeof meta.call_id === 'string' ? (meta.call_id as string) : null
    if (directId) {
      const exact = callsRes.data?.find((c) => c.id === directId)
      if (exact) return exact
    }
    // Fallback: nearest call within 5 minutes of the activity timestamp
    const targetMs = new Date(activityCreatedAt).getTime()
    return callsByTime.find(
      (c) => Math.abs(new Date(c.created_at as string).getTime() - targetMs) < 5 * 60 * 1000,
    )
  }

  function attachVisitForActivity(activityCreatedAt: string) {
    const targetMs = new Date(activityCreatedAt).getTime()
    return visitsByTime.find(
      (v) => Math.abs(new Date(v.started_at as string).getTime() - targetMs) < 5 * 60 * 1000,
    )
  }

  const enriched = (actsRes.data ?? []).map((a) => {
    const base = {
      id: a.id,
      type: a.type,
      content: a.content,
      metadata: a.metadata,
      created_at: a.created_at,
      user: a.user,
      call: null as Record<string, unknown> | null,
      visit: null as Record<string, unknown> | null,
    }
    if (a.type === 'CALL') {
      const c = attachCallForActivity(a.created_at as string, a.metadata)
      if (c) base.call = c
    } else if (a.type === 'VISIT') {
      const v = attachVisitForActivity(a.created_at as string)
      if (v) base.visit = v
    }
    return base
  })

  return NextResponse.json({ data: enriched, has_more: enriched.length === limit })
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: clientId } = await ctx.params
  const access = await ensureAccess(supabase, user.id, clientId)
  if (access === 'not_found') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (access === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 })

  const { data, error } = await supabase
    .from('activities')
    .insert({
      client_id: clientId,
      user_id: user.id,
      type: 'NOTE',
      content,
      metadata: { source: 'timeline' },
    })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: clientId } = await ctx.params
  const access = await ensureAccess(supabase, user.id, clientId)
  if (access === 'not_found') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (access === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const activityId = url.searchParams.get('activity_id')
  if (!activityId) return NextResponse.json({ error: 'activity_id required' }, { status: 400 })

  const { data: row } = await supabase
    .from('activities')
    .select('user_id')
    .eq('id', activityId)
    .eq('client_id', clientId)
    .single()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (row.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase.from('activities').delete().eq('id', activityId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
