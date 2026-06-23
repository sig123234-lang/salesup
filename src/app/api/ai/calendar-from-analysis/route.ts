import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CallAnalysisResult } from '@/types'

type EventType = 'CALL' | 'VISIT' | 'MEETING' | 'FOLLOW_UP' | 'OTHER'

function normalizeEventType(t: string | null | undefined): EventType {
  switch (t) {
    case 'CALL':
    case 'VISIT':
    case 'MEETING':
    case 'FOLLOW_UP':
      return t
    default:
      return 'OTHER'
  }
}

function defaultEnd(start: string): string {
  const d = new Date(start)
  d.setHours(d.getHours() + 1)
  return d.toISOString()
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const callRecordId: string | undefined = body.call_record_id
    const clientId: string | null = body.client_id ?? null
    const overrideEvent: CallAnalysisResult['next_calendar_event'] | undefined =
      body.override_event
    const includeReminders: boolean = body.include_reminders !== false

    let nextEvent = overrideEvent
    let reminders: CallAnalysisResult['cs_reminders'] = []
    let analysisClientId = clientId

    if (callRecordId) {
      const { data: record, error: recErr } = await supabase
        .from('call_records')
        .select('analysis, client_id, user_id')
        .eq('id', callRecordId)
        .single()
      if (recErr || !record) {
        return NextResponse.json({ error: 'Call record not found' }, { status: 404 })
      }
      if (record.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const analysis = record.analysis as CallAnalysisResult | null
      if (!overrideEvent) {
        nextEvent = analysis?.next_calendar_event ?? null
      }
      reminders = analysis?.cs_reminders ?? []
      analysisClientId = clientId ?? record.client_id ?? null
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    const inserts: Array<Record<string, unknown>> = []

    if (nextEvent && nextEvent.suggested_start) {
      inserts.push({
        user_id: user.id,
        company_id: profile?.company_id ?? null,
        client_id: analysisClientId,
        title: nextEvent.title || '후속 연락',
        description: nextEvent.notes || null,
        start_at: nextEvent.suggested_start,
        end_at: nextEvent.suggested_end || defaultEnd(nextEvent.suggested_start),
        type: normalizeEventType(nextEvent.type),
        is_ai_generated: true,
        source: 'ai_analysis',
      })
    }

    if (includeReminders && reminders && reminders.length > 0) {
      for (const r of reminders) {
        if (!r.due_date) continue
        inserts.push({
          user_id: user.id,
          company_id: profile?.company_id ?? null,
          client_id: analysisClientId,
          title: r.title || 'CS 리마인더',
          description: 'AI 자동 생성 CS 리마인더',
          start_at: r.due_date,
          end_at: defaultEnd(r.due_date),
          type: 'FOLLOW_UP',
          is_ai_generated: true,
          source: 'cs_reminder',
        })
      }
    }

    if (inserts.length === 0) {
      return NextResponse.json({ created: 0, events: [] })
    }

    const { data: created, error: insertErr } = await supabase
      .from('calendar_events')
      .insert(inserts)
      .select('*')

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({ created: created?.length ?? 0, events: created ?? [] })
  } catch (err) {
    console.error('calendar-from-analysis error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    )
  }
}
