// Unified AI layer — routes between Claude and OpenAI based on AI_PROVIDER env var.
// Claude is the default. OpenAI is kept as fallback when the request explicitly
// asks for it or when Claude throws.

import { getClaudeClient, CLAUDE_MODELS, getAIProvider } from '@/lib/claude/client'
import { getOpenAIClient } from '@/lib/openai/server'

export type AITask = 'analyze' | 'recommend' | 'chat'

export interface JSONCompletionParams {
  task: AITask
  systemPrompt: string
  userPrompt: string
  temperature?: number
  maxTokens?: number
  forceProvider?: 'claude' | 'openai'
}

export interface JSONCompletionResult<T = unknown> {
  data: T
  provider: 'claude' | 'openai'
  raw: string
}

function pickModel(task: AITask, provider: 'claude' | 'openai'): string {
  if (provider === 'claude') {
    if (task === 'chat') return CLAUDE_MODELS.chat
    if (task === 'recommend') return CLAUDE_MODELS.recommend
    return CLAUDE_MODELS.analyze
  }
  return 'gpt-4o-mini'
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim()
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
  }
  return trimmed
}

function extractJSON(text: string): string {
  const stripped = stripCodeFence(text)
  const firstBrace = stripped.indexOf('{')
  const lastBrace = stripped.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1) return stripped
  return stripped.slice(firstBrace, lastBrace + 1)
}

async function claudeJSON<T>(params: JSONCompletionParams): Promise<JSONCompletionResult<T>> {
  const client = getClaudeClient()
  const model = pickModel(params.task, 'claude')
  const response = await client.messages.create({
    model,
    max_tokens: params.maxTokens ?? 2048,
    temperature: params.temperature ?? 0.3,
    system: params.systemPrompt,
    messages: [{ role: 'user', content: params.userPrompt }],
  })
  const text = response.content
    .filter((c): c is Extract<typeof c, { type: 'text' }> => c.type === 'text')
    .map((c) => c.text)
    .join('')
  const raw = extractJSON(text)
  const data = JSON.parse(raw) as T
  return { data, provider: 'claude', raw }
}

async function openaiJSON<T>(params: JSONCompletionParams): Promise<JSONCompletionResult<T>> {
  const client = getOpenAIClient()
  const completion = await client.chat.completions.create({
    model: pickModel(params.task, 'openai'),
    messages: [
      { role: 'system', content: params.systemPrompt },
      { role: 'user', content: params.userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: params.temperature ?? 0.3,
  })
  const raw = completion.choices[0]?.message?.content || '{}'
  const data = JSON.parse(raw) as T
  return { data, provider: 'openai', raw }
}

export async function jsonCompletion<T = unknown>(
  params: JSONCompletionParams,
): Promise<JSONCompletionResult<T>> {
  const provider = params.forceProvider ?? getAIProvider()
  if (provider === 'claude') {
    try {
      return await claudeJSON<T>(params)
    } catch (err) {
      // Auto-fallback to OpenAI if Claude is unavailable
      if (process.env.OPENAI_API_KEY) {
        console.warn('[ai/unified] Claude failed, falling back to OpenAI:', err)
        return await openaiJSON<T>(params)
      }
      throw err
    }
  }
  return await openaiJSON<T>(params)
}

// ============================================================
// Streaming text (chat)
// ============================================================

export interface ChatStreamParams {
  systemPrompt: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  temperature?: number
  maxTokens?: number
}

/**
 * Returns a ReadableStream of UTF-8 text deltas (plain text, not SSE),
 * so the client can consume it with `response.body.getReader()` and append.
 */
export async function chatStream(params: ChatStreamParams): Promise<ReadableStream<Uint8Array>> {
  const provider = getAIProvider()
  if (provider === 'claude') {
    return await claudeChatStream(params)
  }
  return await openaiChatStream(params)
}

async function claudeChatStream(params: ChatStreamParams): Promise<ReadableStream<Uint8Array>> {
  const client = getClaudeClient()
  const stream = await client.messages.create({
    model: CLAUDE_MODELS.chat,
    max_tokens: params.maxTokens ?? 1024,
    temperature: params.temperature ?? 0.6,
    system: params.systemPrompt,
    messages: params.messages,
    stream: true,
  })
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
        controller.close()
      } catch (err) {
        controller.error(err)
      }
    },
  })
}

async function openaiChatStream(params: ChatStreamParams): Promise<ReadableStream<Uint8Array>> {
  const client = getOpenAIClient()
  const stream = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: params.systemPrompt },
      ...params.messages,
    ],
    temperature: params.temperature ?? 0.6,
    stream: true,
  })
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content
          if (delta) controller.enqueue(encoder.encode(delta))
        }
        controller.close()
      } catch (err) {
        controller.error(err)
      }
    },
  })
}
