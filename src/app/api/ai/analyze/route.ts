import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jsonCompletion } from '@/lib/ai/unified'
import { buildAnalyzePrompt } from '@/lib/claude/prompts'
import type { CallAnalysisResult } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { transcript, type, clientContext } = await req.json()
    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json({ error: 'transcript is required' }, { status: 400 })
    }

    const todayDate = new Date().toISOString().slice(0, 10)
    const systemPrompt = buildAnalyzePrompt(todayDate, clientContext || '')
    const userPrompt = `${type === 'visit' ? '방문' : type === 'text_input' ? '통화 요약' : '통화'} 내용:\n${transcript}`

    const { data: analysis, provider } = await jsonCompletion<CallAnalysisResult>({
      task: 'analyze',
      systemPrompt,
      userPrompt,
      maxTokens: 3072,
    })

    return NextResponse.json({ analysis, provider })
  } catch (error) {
    console.error('Analysis error:', error)
    const message =
      error instanceof Error && /ANTHROPIC_API_KEY|OPENAI_API_KEY/.test(error.message)
        ? error.message
        : 'Analysis failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
