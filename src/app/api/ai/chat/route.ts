import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildChatPrompt } from '@/lib/claude/prompts'
import { chatStream } from '@/lib/ai/unified'

interface ChatMessageIn {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json()
    const rawMessages: ChatMessageIn[] = Array.isArray(body.messages) ? body.messages : []
    const pageContext: string | undefined = body.page_context

    if (rawMessages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Token-cost guard: only the most recent 20 turns are sent to the model.
    // The client still keeps full history locally for display/scrollback.
    const MAX_TURNS = 20
    const messages = rawMessages.slice(-MAX_TURNS)

    const [{ data: profile }, { count: clientCount }] = await Promise.all([
      supabase
        .from('profiles')
        .select('full_name, company_id, metadata, company:companies(name)')
        .eq('id', user.id)
        .single(),
      supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id),
    ])

    const aiSettings =
      ((profile?.metadata as Record<string, unknown> | null)?.ai_settings as
        | Record<string, unknown>
        | undefined) ?? {}
    const companyRaw = profile?.company as unknown
    const companyName = Array.isArray(companyRaw)
      ? (companyRaw[0] as { name?: string } | undefined)?.name
      : (companyRaw as { name?: string } | null | undefined)?.name

    const systemPrompt = buildChatPrompt({
      companyName: companyName ?? null,
      productDescription: (aiSettings.product_description as string) ?? null,
      targetCustomer: (aiSettings.target_customer as string) ?? null,
      avgDealSize: (aiSettings.avg_deal_size as string) ?? null,
      salesCycleDays: (aiSettings.sales_cycle_days as number) ?? null,
      competitors: (aiSettings.competitors as string[]) ?? null,
      customInstructions: (aiSettings.custom_instructions as string) ?? null,
      industryTemplate: (aiSettings.industry_template as string) ?? null,
      userName: profile?.full_name ?? null,
      territory: (aiSettings.territory as string) ?? null,
      activeClients: clientCount ?? null,
    })

    const finalSystem = pageContext
      ? `${systemPrompt}\n\n## 현재 페이지 컨텍스트\n${pageContext}`
      : systemPrompt

    const stream = await chatStream({
      systemPrompt: finalSystem,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      maxTokens: 1024,
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    console.error('chat error:', err)
    const message = err instanceof Error ? err.message : 'Chat failed'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
