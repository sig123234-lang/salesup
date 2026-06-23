import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jsonCompletion } from '@/lib/ai/unified'
import type { CallAnalysisResult, VisitAnalysisResult } from '@/types'

interface ReportSection {
  title: string
  items: string[]
}

interface DailyReport {
  date: string
  summary: string
  highlights: string[]
  sections: ReportSection[]
  markdown: string
}

function ymd(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const SYSTEM_PROMPT = `당신은 영업사원의 하루 활동을 정리해 일지(daily report)를 작성하는 AI입니다.

요구사항:
- 한국어, 영업 현장 어휘 사용
- 사실에 기반 (입력 데이터에 없는 내용 절대 추가 금지)
- 액션 우선 ("내일 해야 할 일" 섹션은 구체적으로)

출력 JSON (마크다운/코드블럭 없이):
{
  "date": "YYYY-MM-DD",
  "summary": "오늘 활동 총평 1~2문장",
  "highlights": ["주요 인사이트 2~4개"],
  "sections": [
    { "title": "📞 통화 요약 (N건)", "items": ["거래처: 핵심 내용 + 다음 액션"] },
    { "title": "🚗 방문 요약 (N건)", "items": ["..."] },
    { "title": "📝 메모/기타 (N건)", "items": ["..."] },
    { "title": "📋 내일 해야 할 일", "items": ["구체적 액션 3~5개"] }
  ],
  "markdown": "전체 일지를 마크다운 형식으로 (헤더 #, 리스트 -, 강조 ** 활용). 카카오톡/이메일에 바로 붙여넣을 수 있는 형태."
}

규칙:
- 데이터가 비어 있으면 해당 섹션은 생략하거나 "활동 없음"으로 표기
- markdown은 sections 내용을 그대로 풀어 재정리한 완전한 보고서`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json().catch(() => ({}))
    const dateStr: string = body.date || ymd(new Date())
    const target = new Date(`${dateStr}T00:00:00`)
    const dayStart = new Date(target.getFullYear(), target.getMonth(), target.getDate())
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)

    const [callsRes, visitsRes, activitiesRes, eventsRes] = await Promise.all([
      supabase
        .from('call_records')
        .select('analysis, transcript, created_at, client:clients(name)')
        .eq('user_id', user.id)
        .gte('created_at', dayStart.toISOString())
        .lt('created_at', dayEnd.toISOString())
        .order('created_at', { ascending: true })
        .limit(50),
      supabase
        .from('visit_records')
        .select('analysis, transcript, started_at, ended_at, client:clients(name)')
        .eq('user_id', user.id)
        .gte('started_at', dayStart.toISOString())
        .lt('started_at', dayEnd.toISOString())
        .order('started_at', { ascending: true })
        .limit(50),
      supabase
        .from('activities')
        .select('type, content, created_at, client:clients(name)')
        .eq('user_id', user.id)
        .gte('created_at', dayStart.toISOString())
        .lt('created_at', dayEnd.toISOString())
        .eq('type', 'NOTE')
        .order('created_at', { ascending: true })
        .limit(50),
      supabase
        .from('calendar_events')
        .select('title, type, start_at, is_completed, client:clients(name)')
        .eq('user_id', user.id)
        .gte('start_at', dayStart.toISOString())
        .lt('start_at', dayEnd.toISOString())
        .order('start_at', { ascending: true })
        .limit(50),
    ])

    type CallClient = { name?: string } | { name?: string }[] | null
    function clientName(c: CallClient): string | null {
      if (!c) return null
      if (Array.isArray(c)) return c[0]?.name ?? null
      return c.name ?? null
    }

    // Adaptive transcript cap: 2000 chars normally; drop to 1000 when there are
    // 5+ calls so the total prompt stays within a comfortable context window.
    const totalCalls = callsRes.data?.length ?? 0
    const transcriptCap = totalCalls >= 5 ? 1000 : 2000

    const calls = (callsRes.data ?? []).map((c) => ({
      client: clientName(c.client as CallClient),
      analysis: c.analysis as CallAnalysisResult | null,
      transcript: (c.transcript as string | null)?.slice(0, transcriptCap) ?? null,
      time: c.created_at,
    }))
    const visits = (visitsRes.data ?? []).map((v) => ({
      client: clientName(v.client as CallClient),
      analysis: v.analysis as VisitAnalysisResult | null,
      transcript: (v.transcript as string | null)?.slice(0, transcriptCap) ?? null,
      start: v.started_at,
      end: v.ended_at,
    }))
    const notes = (activitiesRes.data ?? []).map((a) => ({
      client: clientName(a.client as CallClient),
      content: (a.content as string | null) ?? '',
      time: a.created_at,
    }))
    const events = (eventsRes.data ?? []).map((e) => ({
      client: clientName(e.client as CallClient),
      title: e.title,
      type: e.type,
      time: e.start_at,
      completed: e.is_completed,
    }))

    if (calls.length === 0 && visits.length === 0 && notes.length === 0 && events.length === 0) {
      const empty: DailyReport = {
        date: dateStr,
        summary: '오늘 기록된 영업 활동이 없어요.',
        highlights: [],
        sections: [],
        markdown: `# ${dateStr} 영업 일지\n\n오늘 기록된 활동이 없습니다.`,
      }
      return NextResponse.json({ data: empty })
    }

    const userPrompt = JSON.stringify({
      date: dateStr,
      calls,
      visits,
      notes,
      events,
    })

    const result = await jsonCompletion<DailyReport>({
      task: 'recommend',
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 2500,
      temperature: 0.4,
    })
    const report: DailyReport = {
      date: result.data.date || dateStr,
      summary: result.data.summary || '',
      highlights: Array.isArray(result.data.highlights) ? result.data.highlights : [],
      sections: Array.isArray(result.data.sections) ? result.data.sections : [],
      markdown: result.data.markdown || `# ${dateStr} 영업 일지\n\n${result.data.summary ?? ''}`,
    }

    return NextResponse.json({ data: report })
  } catch (err) {
    console.error('daily-report error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    )
  }
}
