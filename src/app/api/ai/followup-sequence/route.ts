import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jsonCompletion } from '@/lib/ai/unified'
import type { CallAnalysisResult, Client } from '@/types'

type SequenceType = 'standard' | 'hot' | 'nurture' | 'cs'
type EventType = 'CALL' | 'VISIT' | 'MEETING' | 'FOLLOW_UP'

interface SequenceStep {
  step: number
  title: string
  due_date: string // ISO
  type: EventType
  notes: string
}

interface SequencePlan {
  sequence: SequenceStep[]
}

const INTERVALS: Record<SequenceType, number[]> = {
  standard: [2, 5, 10, 21, 30],
  hot: [1, 3, 7, 14],
  nurture: [7, 21, 45, 90],
  cs: [7, 30, 90, 180, 270, 335],
}

const TYPE_LABEL: Record<SequenceType, string> = {
  standard: '일반 팔로업',
  hot: '핫 팔로업',
  nurture: '장기 육성',
  cs: 'CS 사후관리',
}

const SYSTEM_PROMPT = `당신은 영업 팔로업 시퀀스 전문가입니다.
영업사원이 등록할 팔로업 일정의 각 단계(step)에 대해 제목과 메모를 한국어로 작성합니다.

규칙:
- 각 단계의 제목은 "{거래처명} {N}차 팔로업 — {목적}" 형식 (간결, 30자 이내)
- 메모는 지난 통화/거래 맥락을 반영한 1~2문장 (없으면 일반 팔로업 가이드)
- type은 단계별로 의미에 맞게 CALL/VISIT/MEETING/FOLLOW_UP 중 선택
  · 1차/2차는 CALL 또는 FOLLOW_UP 중심
  · CS 시퀀스는 D+90 이상에서 VISIT/MEETING 권장
- 입력으로 받은 sequence(step, days_from_base, default_due_date) 배열의 길이만큼 그대로 반환

출력 JSON (마크다운 없이):
{
  "sequence": [
    { "step": 1, "title": "...", "due_date": "ISO", "type": "CALL|VISIT|MEETING|FOLLOW_UP", "notes": "..." }
  ]
}`

function addDays(base: Date, days: number) {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  d.setHours(10, 0, 0, 0)
  return d
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const clientId: string = body.client_id
    const callRecordId: string | null = body.call_record_id ?? null
    const sequenceType: SequenceType = (body.sequence_type as SequenceType) ?? 'standard'
    const baseDate = body.base_date ? new Date(body.base_date) : new Date()
    const overwrite: boolean = body.overwrite === true

    if (!clientId) {
      return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
    }

    const intervals = INTERVALS[sequenceType]
    if (!intervals) {
      return NextResponse.json({ error: 'invalid sequence_type' }, { status: 400 })
    }

    const { data: clientRow } = await supabase
      .from('clients')
      .select('id, name, sales_status, contract_probability, contact_name, owner_id, company_id')
      .eq('id', clientId)
      .single()

    if (!clientRow) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    if (clientRow.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const client = clientRow as Pick<
      Client,
      'id' | 'name' | 'sales_status' | 'contract_probability' | 'contact_name' | 'owner_id' | 'company_id'
    >

    // Pull last call analysis for context
    let lastAnalysis: CallAnalysisResult | null = null
    if (callRecordId) {
      const { data: callRow } = await supabase
        .from('call_records')
        .select('analysis')
        .eq('id', callRecordId)
        .single()
      lastAnalysis = (callRow?.analysis as CallAnalysisResult | null) ?? null
    } else {
      const { data: latestCall } = await supabase
        .from('call_records')
        .select('analysis')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      lastAnalysis = (latestCall?.analysis as CallAnalysisResult | null) ?? null
    }

    // Check for existing sequence
    const { data: existing } = await supabase
      .from('calendar_events')
      .select('id')
      .eq('user_id', user.id)
      .eq('client_id', clientId)
      .eq('source', 'followup_sequence')
      .eq('is_completed', false)

    if (existing && existing.length > 0 && !overwrite) {
      return NextResponse.json(
        {
          error: 'sequence_exists',
          message: '이미 진행 중인 시퀀스가 있어요. overwrite=true 로 다시 시도하세요.',
          existing_count: existing.length,
        },
        { status: 409 },
      )
    }

    if (existing && existing.length > 0 && overwrite) {
      await supabase
        .from('calendar_events')
        .delete()
        .in(
          'id',
          existing.map((e) => e.id as string),
        )
    }

    const seed: SequenceStep[] = intervals.map((days, i) => {
      const dueDate = addDays(baseDate, days)
      const defaultType: EventType =
        sequenceType === 'cs' && days >= 90 ? 'VISIT' : 'FOLLOW_UP'
      return {
        step: i + 1,
        title: `${client.name} ${i + 1}차 ${TYPE_LABEL[sequenceType]}`,
        due_date: dueDate.toISOString(),
        type: defaultType,
        notes: '',
      }
    })

    let plan: SequencePlan = { sequence: seed }
    try {
      const userPrompt = JSON.stringify({
        client: {
          name: client.name,
          status: client.sales_status,
          probability: client.contract_probability,
          contact_name: client.contact_name,
        },
        sequence_type: sequenceType,
        sequence: seed.map((s) => ({
          step: s.step,
          default_due_date: s.due_date,
          default_type: s.type,
        })),
        last_call_summary: lastAnalysis
          ? {
              summary: lastAnalysis.summary,
              reaction: lastAnalysis.customer_reaction,
              contract_probability: lastAnalysis.contract_probability,
              competitor_names: lastAnalysis.competitor_names,
              recommended_actions: lastAnalysis.recommended_actions,
            }
          : null,
      })
      const result = await jsonCompletion<SequencePlan>({
        task: 'recommend',
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        maxTokens: 1500,
        temperature: 0.4,
      })
      if (Array.isArray(result.data.sequence) && result.data.sequence.length > 0) {
        plan = {
          sequence: seed.map((s, i) => {
            const aiStep = result.data.sequence[i] ?? s
            return {
              step: s.step,
              title: aiStep.title || s.title,
              due_date: aiStep.due_date || s.due_date,
              type: (aiStep.type as EventType) || s.type,
              notes: aiStep.notes || '',
            }
          }),
        }
      }
    } catch (err) {
      console.error('followup-sequence AI fallback:', err)
    }

    const inserts = plan.sequence.map((s) => ({
      user_id: user.id,
      company_id: client.company_id,
      client_id: client.id,
      title: s.title,
      description: s.notes || null,
      start_at: s.due_date,
      end_at: new Date(new Date(s.due_date).getTime() + 60 * 60 * 1000).toISOString(),
      type: s.type,
      is_ai_generated: true,
      source: 'followup_sequence',
    }))

    const { data: created, error: insertErr } = await supabase
      .from('calendar_events')
      .insert(inserts)
      .select('*')

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({
      sequence_type: sequenceType,
      created: created?.length ?? 0,
      events: created ?? [],
      sequence: plan.sequence,
    })
  } catch (err) {
    console.error('followup-sequence error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    )
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const clientId = url.searchParams.get('client_id')
  if (!clientId) return NextResponse.json({ error: 'client_id is required' }, { status: 400 })

  const { data } = await supabase
    .from('calendar_events')
    .select('id, title, start_at, type, is_completed')
    .eq('user_id', user.id)
    .eq('client_id', clientId)
    .eq('source', 'followup_sequence')
    .order('start_at', { ascending: true })

  const rows = data ?? []
  const total = rows.length
  const completed = rows.filter((r) => r.is_completed).length
  return NextResponse.json({
    total,
    completed,
    in_progress: total > 0,
    steps: rows,
  })
}
