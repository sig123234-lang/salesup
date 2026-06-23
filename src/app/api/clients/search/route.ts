import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SalesStatus } from '@/types'

const VALID_STATUS: SalesStatus[] = [
  'NEW_LEAD',
  'FIRST_VISIT',
  'QUOTE_SENT',
  'FOLLOW_UP',
  'CONTRACT_IN_PROGRESS',
  'CONTRACTED',
  'REJECTED',
  'POTENTIAL',
]

type SortMode =
  | 'recent_updated'
  | 'probability_desc'
  | 'last_contact_oldest'
  | 'name_asc'

type ContactWindow = 'all' | 'today' | 'this_week' | 'this_month' | 'over_30'

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const params = url.searchParams

  const statusParam = params.get('status') || ''
  const statuses = statusParam
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is SalesStatus => (VALID_STATUS as string[]).includes(s))

  const minProb = clampInt(params.get('min_prob'), 0, 0, 100)
  const maxProb = clampInt(params.get('max_prob'), 100, 0, 100)

  const industries = (params.get('industries') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const tags = (params.get('tags') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const contactWindow = (params.get('contact_window') || 'all') as ContactWindow
  const q = params.get('q')?.trim() ?? ''

  const sort = (params.get('sort') || 'recent_updated') as SortMode
  const page = Math.max(1, parseInt(params.get('page') || '1', 10))
  const pageSize = 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()
  const companyId = profileRow?.company_id ?? null

  let query = supabase
    .from('clients')
    .select('*', { count: 'exact' })

  if (companyId) {
    query = query.or(`owner_id.eq.${user.id},company_id.eq.${companyId}`)
  } else {
    query = query.eq('owner_id', user.id)
  }

  if (statuses.length > 0) {
    query = query.in('sales_status', statuses)
  }

  query = query.gte('contract_probability', minProb).lte('contract_probability', maxProb)

  if (industries.length > 0) query = query.in('industry', industries)
  if (tags.length > 0) {
    // any of the supplied tags must match. PostgREST overlap operator on text[]
    query = query.overlaps('tags', tags)
  }

  if (q) {
    const safe = q.replace(/[%_]/g, (m) => `\\${m}`)
    query = query.or(
      `name.ilike.%${safe}%,contact_name.ilike.%${safe}%,phone.ilike.%${safe}%`,
    )
  }

  if (contactWindow !== 'all') {
    const now = new Date()
    if (contactWindow === 'over_30') {
      const thirtyAgo = new Date(now)
      thirtyAgo.setDate(thirtyAgo.getDate() - 30)
      // include NULL last_contacted_at as well
      query = query.or(
        `last_contacted_at.is.null,last_contacted_at.lt.${thirtyAgo.toISOString()}`,
      )
    } else {
      const from = startOfDay(now)
      if (contactWindow === 'this_week') {
        from.setDate(from.getDate() - from.getDay())
      } else if (contactWindow === 'this_month') {
        from.setDate(1)
      }
      query = query.gte('last_contacted_at', from.toISOString())
    }
  }

  switch (sort) {
    case 'probability_desc':
      query = query.order('contract_probability', { ascending: false })
      break
    case 'last_contact_oldest':
      query = query.order('last_contacted_at', { ascending: true, nullsFirst: true })
      break
    case 'name_asc':
      query = query.order('name', { ascending: true })
      break
    case 'recent_updated':
    default:
      query = query.order('updated_at', { ascending: false })
      break
  }

  query = query.range(from, to)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    page,
    page_size: pageSize,
    has_more: (count ?? 0) > to + 1,
  })
}

function clampInt(raw: string | null, fallback: number, min: number, max: number) {
  if (raw == null) return fallback
  const v = parseInt(raw, 10)
  if (!Number.isFinite(v)) return fallback
  return Math.min(max, Math.max(min, v))
}
