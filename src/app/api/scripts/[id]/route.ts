import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

async function loadOwned(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  id: string,
) {
  const { data, error } = await supabase
    .from('scripts')
    .select('id, user_id')
    .eq('id', id)
    .single()
  if (error || !data) return null
  if (data.user_id !== userId) return 'forbidden'
  return data
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const owned = await loadOwned(supabase, user.id, id)
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (owned === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  if (typeof body.title === 'string') updates.title = body.title.trim()
  if (typeof body.content === 'string') updates.content = body.content.trim()
  if (typeof body.category === 'string') updates.category = body.category
  if (Array.isArray(body.tags))
    updates.tags = (body.tags as unknown[]).map((t) => String(t)).slice(0, 10)
  if (typeof body.is_shared === 'boolean') updates.is_shared = body.is_shared

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('scripts')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const owned = await loadOwned(supabase, user.id, id)
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (owned === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase.from('scripts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// POST increments use_count. Anyone the RLS policy lets see the row may use it,
// including shared scripts from team members.
export async function POST(_req: NextRequest, ctx: RouteContext) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const { data: current } = await supabase
    .from('scripts')
    .select('use_count')
    .eq('id', id)
    .single()
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const next = (current.use_count ?? 0) + 1
  const { error } = await supabase
    .from('scripts')
    .update({ use_count: next })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ use_count: next })
}
