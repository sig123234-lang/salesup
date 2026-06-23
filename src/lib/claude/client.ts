import Anthropic from '@anthropic-ai/sdk'

let cachedClient: Anthropic | null = null

export function getClaudeClient(): Anthropic {
  if (cachedClient) return cachedClient
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY')
  cachedClient = new Anthropic({ apiKey })
  return cachedClient
}

export const CLAUDE_MODELS = {
  analyze: process.env.CLAUDE_ANALYZE_MODEL || 'claude-haiku-4-5-20251001',
  chat: process.env.CLAUDE_CHAT_MODEL || 'claude-sonnet-4-6',
  recommend: process.env.CLAUDE_RECOMMEND_MODEL || 'claude-haiku-4-5-20251001',
} as const

export type AIProvider = 'claude' | 'openai'

export function getAIProvider(): AIProvider {
  const v = (process.env.AI_PROVIDER || 'claude').toLowerCase()
  return v === 'openai' ? 'openai' : 'claude'
}
