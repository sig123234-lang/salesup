import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface IncomingSubscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

interface IncomingSettings {
  enabled?: boolean
  remind_minutes_before?: number
  morning_hour?: number
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const sub = body.subscription as IncomingSubscription | undefined
  const settings = (body.settings ?? {}) as IncomingSettings
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: 'invalid subscription' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('metadata')
    .eq('id', user.id)
    .single()

  const nextMeta = {
    ...((profile?.metadata as Record<string, unknown>) ?? {}),
    push_subscription: sub,
    notification_settings: {
      enabled: settings.enabled !== false,
      remind_minutes_before:
        typeof settings.remind_minutes_before === 'number'
          ? settings.remind_minutes_before
          : 30,
      morning_hour:
        typeof settings.morning_hour === 'number' ? settings.morning_hour : 9,
    },
  }
  await supabase.from('profiles').update({ metadata: nextMeta }).eq('id', user.id)
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const settings = (body.settings ?? {}) as IncomingSettings

  const { data: profile } = await supabase
    .from('profiles')
    .select('metadata')
    .eq('id', user.id)
    .single()

  const meta = (profile?.metadata as Record<string, unknown>) ?? {}
  const currentSettings =
    (meta.notification_settings as IncomingSettings | undefined) ?? {}
  const merged = {
    ...currentSettings,
    ...settings,
  }
  const next = { ...meta, notification_settings: merged }
  await supabase.from('profiles').update({ metadata: next }).eq('id', user.id)
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('metadata')
    .eq('id', user.id)
    .single()

  const meta = { ...((profile?.metadata as Record<string, unknown>) ?? {}) }
  delete meta.push_subscription
  const settings =
    (meta.notification_settings as Record<string, unknown> | undefined) ?? {}
  meta.notification_settings = { ...settings, enabled: false }
  await supabase.from('profiles').update({ metadata: meta }).eq('id', user.id)
  return NextResponse.json({ ok: true })
}
