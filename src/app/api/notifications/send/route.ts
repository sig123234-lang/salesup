import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPush, pushReadinessError, type PushSubscriptionJSON } from '@/lib/notifications/webPush'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const targetUserId: string = body.user_id || user.id
  const title: string = body.title || 'SalesUp'
  const text: string = body.body || ''
  const url: string | undefined = body.url

  // Only admins or self can send. Others get 403.
  if (targetUserId !== user.id) {
    const { data: requester } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (
      !requester ||
      (requester.role !== 'COMPANY_ADMIN' && requester.role !== 'SUPER_ADMIN')
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('metadata')
    .eq('id', targetUserId)
    .single()

  const meta = (profile?.metadata as Record<string, unknown> | null) ?? {}
  const sub = meta.push_subscription as PushSubscriptionJSON | undefined
  if (!sub) {
    return NextResponse.json({ error: 'No push subscription for user' }, { status: 404 })
  }

  const result = await sendPush(sub, { title, body: text, url, tag: body.tag })
  if (!result.ok) {
    const ready = await pushReadinessError()
    return NextResponse.json(
      { error: result.error, hint: ready ?? null },
      { status: 500 },
    )
  }
  return NextResponse.json({ ok: true })
}
