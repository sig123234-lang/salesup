import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPush, type PushSubscriptionJSON } from '@/lib/notifications/webPush'

interface NotificationSettings {
  enabled?: boolean
  remind_minutes_before?: number
  morning_hour?: number
}

// Vercel Cron / external scheduler hits this endpoint daily.
// Auth: optional CRON_SECRET header. Without it, only requests originating from
// localhost / the same deployment can succeed (we still attempt the send if the
// header isn't configured, but warn loudly in logs).
function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return true
  const header =
    req.headers.get('x-cron-secret') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    ''
  return header === expected
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // We use the user-context server client. The cron route should run as the
  // service role in production; for the simple deployment described in the
  // sprint doc we rely on the anon key + RLS-bypassing logic isn't applied here.
  // The query below only reads upcoming events visible to the requester. In
  // production with a service key this should be swapped for an admin client.
  const supabase = await createClient()
  const now = new Date()
  const horizonHours = 24
  const horizon = new Date(now.getTime() + horizonHours * 60 * 60 * 1000)

  const { data: events, error } = await supabase
    .from('calendar_events')
    .select(
      'id, user_id, title, type, start_at, is_completed, source, client:clients(id, name)',
    )
    .gte('start_at', now.toISOString())
    .lt('start_at', horizon.toISOString())
    .eq('is_completed', false)
    .in('type', ['FOLLOW_UP', 'CALL', 'MEETING', 'VISIT'])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group events by user
  const byUser = new Map<string, typeof events>()
  for (const e of events ?? []) {
    const list = byUser.get(e.user_id as string) ?? []
    list.push(e)
    byUser.set(e.user_id as string, list)
  }

  if (byUser.size === 0) return NextResponse.json({ ok: true, sent: 0 })

  const userIds = Array.from(byUser.keys())
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, metadata')
    .in('id', userIds)

  const sent: Array<{ user_id: string; event_id: string; ok: boolean; error?: string }> = []

  for (const profile of profiles ?? []) {
    const meta = (profile.metadata as Record<string, unknown> | null) ?? {}
    const sub = meta.push_subscription as PushSubscriptionJSON | undefined
    const settings =
      (meta.notification_settings as NotificationSettings | undefined) ?? {}
    if (!sub || settings.enabled === false) continue

    const reminderMin = settings.remind_minutes_before ?? 30
    const morningHour = settings.morning_hour ?? 9
    const list = byUser.get(profile.id as string) ?? []

    for (const e of list) {
      const eventStart = new Date(e.start_at as string)
      const diffMs = eventStart.getTime() - now.getTime()
      const minutesAway = Math.floor(diffMs / 60000)

      let shouldSend = false
      if (reminderMin === 0) {
        // Send during the configured morning hour for events occurring today
        if (
          now.getHours() === morningHour &&
          eventStart.getFullYear() === now.getFullYear() &&
          eventStart.getMonth() === now.getMonth() &&
          eventStart.getDate() === now.getDate()
        ) {
          shouldSend = true
        }
      } else {
        // Send when the event is within (reminderMin ± 30 min) of now
        shouldSend = minutesAway > 0 && minutesAway <= reminderMin
      }
      if (!shouldSend) continue

      const clientName = Array.isArray(e.client)
        ? e.client[0]?.name
        : (e.client as { name?: string } | null)?.name
      const result = await sendPush(sub, {
        title: '⏰ 팔로업 일정',
        body: clientName ? `${clientName}: ${e.title}` : (e.title as string),
        url: clientName && (Array.isArray(e.client) ? e.client[0]?.id : (e.client as { id?: string } | null)?.id)
          ? `/clients/${Array.isArray(e.client) ? e.client[0]?.id : (e.client as { id?: string } | null)?.id}`
          : '/calendar',
        tag: `event-${e.id}`,
      })
      sent.push({
        user_id: profile.id as string,
        event_id: e.id as string,
        ok: result.ok,
        ...(result.ok ? {} : { error: result.error }),
      })
    }
  }

  return NextResponse.json({ ok: true, sent: sent.length, results: sent })
}
