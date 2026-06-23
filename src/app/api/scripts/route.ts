import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const category = url.searchParams.get('category')
  const q = url.searchParams.get('q')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10) || 100, 200)

  let query = supabase
    .from('scripts')
    .select('id, user_id, company_id, title, content, category, tags, use_count, is_shared, created_at, updated_at')
    .order('use_count', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (category && category !== 'all') query = query.eq('category', category)
  if (q && q.trim().length > 0) {
    const safe = q.trim().replace(/[%_]/g, (m) => `\\${m}`)
    query = query.or(`title.ilike.%${safe}%,content.ilike.%${safe}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Decorate with `ownership: 'mine' | 'shared'` so the UI can show team badge.
  const scripts = (data ?? []).map((s) => ({
    ...s,
    ownership: s.user_id === user.id ? 'mine' : 'shared',
  }))
  return NextResponse.json({ data: scripts })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  const category = typeof body.category === 'string' ? body.category : 'general'
  const tags = Array.isArray(body.tags)
    ? (body.tags as unknown[]).map((t) => String(t)).slice(0, 10)
    : []
  const isShared = body.is_shared === true

  if (!title || !content) {
    return NextResponse.json({ error: 'title and content are required' }, { status: 400 })
  }

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  const { data, error } = await supabase
    .from('scripts')
    .insert({
      user_id: user.id,
      company_id: profileRow?.company_id ?? null,
      title,
      content,
      category,
      tags,
      is_shared: isShared,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
