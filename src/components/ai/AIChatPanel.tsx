'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { BookText, Bot, ChevronRight, Loader2, Send, Sparkles, Trash2, X } from 'lucide-react'
import { useAIChatStore } from '@/store'
import type { ChatMessage } from '@/types'
import { cn } from '@/lib/utils'

const QUICK_PROMPTS: Array<{ label: string; prompt: string }> = [
  { label: '오늘 팔로업해야 할 거래처는?', prompt: '오늘 우선적으로 팔로업해야 할 거래처와 그 이유를 알려주세요.' },
  {
    label: '이 거래처 어떻게 접근할까요?',
    prompt: '지금 보고 있는 거래처에 어떻게 접근하면 좋을지 알려주세요.',
  },
  { label: '팔로업 문자 작성해줘', prompt: '방금 통화한 고객에게 보낼 팔로업 문자 멘트를 작성해주세요.' },
  { label: '계약 확률 높이는 방법은?', prompt: '계약 확률을 단기간에 높이는 실전 팁 3가지를 알려주세요.' },
]

interface ScriptOption {
  id: string
  title: string
  content: string
  use_count: number
  category: string
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function AIChatPanel() {
  const pathname = usePathname()
  const { isOpen, close, messages, addMessage, updateLastAssistant, clearHistory } =
    useAIChatStore()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scriptsOpen, setScriptsOpen] = useState(false)
  const [scripts, setScripts] = useState<ScriptOption[]>([])
  const [scriptsLoading, setScriptsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const openScriptPicker = async () => {
    setScriptsOpen(true)
    setScriptsLoading(true)
    try {
      const res = await fetch('/api/scripts?limit=5', { cache: 'no-store' })
      const json = await res.json()
      setScripts((json.data ?? []) as ScriptOption[])
    } finally {
      setScriptsLoading(false)
    }
  }

  const insertScript = (s: ScriptOption) => {
    setInput((prev) => (prev ? `${prev}\n\n${s.content}` : s.content))
    setScriptsOpen(false)
    // Fire-and-forget use_count++
    void fetch(`/api/scripts/${s.id}`, { method: 'POST' })
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const send = async (rawText: string) => {
    const text = rawText.trim()
    if (!text || sending) return

    setError(null)
    const userMsg: ChatMessage = {
      id: makeId(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    const assistantMsg: ChatMessage = {
      id: makeId(),
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    }
    addMessage(userMsg)
    addMessage(assistantMsg)
    setInput('')
    setSending(true)

    try {
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }))
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          page_context: `사용자가 현재 보고 있는 페이지: ${pathname}`,
        }),
      })

      if (!res.ok || !res.body) {
        const body = await res.text().catch(() => '')
        let msg = '응답을 받지 못했습니다.'
        try {
          msg = JSON.parse(body).error || msg
        } catch {
          // ignore
        }
        throw new Error(msg)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) updateLastAssistant(decoder.decode(value, { stream: true }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
      updateLastAssistant('\n\n[응답 중 오류가 발생했습니다.]')
    } finally {
      setSending(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            onClick={close}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className="fixed top-0 right-0 bottom-0 z-[61] w-full sm:max-w-md bg-white dark:bg-slate-900 shadow-2xl flex flex-col"
            role="dialog"
            aria-label="AI 채팅"
          >
            <header className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                <div>
                  <p className="font-semibold text-sm">업이 (UP-E)</p>
                  <p className="text-[11px] opacity-80">SalesUp AI 영업 코치</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={clearHistory}
                  className="p-1.5 rounded-lg hover:bg-white/20"
                  title="대화 초기화"
                  aria-label="clear"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={close}
                  className="p-1.5 rounded-lg hover:bg-white/20"
                  aria-label="close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </header>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50 dark:bg-slate-950"
            >
              {messages.length === 0 ? (
                <div className="text-center py-10 space-y-4">
                  <Sparkles className="w-10 h-10 text-indigo-400 mx-auto" />
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    안녕하세요, 업이입니다. 영업 관련 무엇이든 물어보세요.
                  </p>
                  <div className="space-y-2">
                    {QUICK_PROMPTS.map((q) => (
                      <button
                        key={q.label}
                        onClick={() => send(q.prompt)}
                        className="block w-full text-left px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-indigo-400 transition-colors"
                      >
                        💡 {q.label}
                      </button>
                    ))}
                    <button
                      onClick={openScriptPicker}
                      className="flex items-center justify-between w-full text-left px-3 py-2 text-sm bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-xl hover:border-indigo-400 transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <BookText className="w-4 h-4" />
                        스크립트 라이브러리에서 불러오기
                      </span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      'flex',
                      m.role === 'user' ? 'justify-end' : 'justify-start',
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed shadow-sm',
                        m.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-sm border border-slate-100 dark:border-slate-700',
                      )}
                    >
                      {m.content || (
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <Loader2 className="w-3 h-3 animate-spin" /> 생각 중...
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}

              {error && (
                <div className="px-3 py-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs rounded-xl">
                  {error}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                void send(input)
              }}
              className="border-t border-slate-100 dark:border-slate-800 p-3 bg-white dark:bg-slate-900"
            >
              <div className="flex items-center gap-1 mb-2">
                <button
                  type="button"
                  onClick={openScriptPicker}
                  className="text-[11px] text-indigo-600 dark:text-indigo-300 hover:text-indigo-500 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                >
                  <BookText className="w-3 h-3" />
                  스크립트
                </button>
              </div>
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void send(input)
                    }
                  }}
                  rows={1}
                  placeholder="궁금한 점을 입력하세요... (Shift+Enter 줄바꿈)"
                  className="flex-1 resize-none rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 max-h-32"
                />
                <button
                  type="submit"
                  disabled={sending || input.trim().length === 0}
                  className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white flex items-center justify-center transition-all"
                  aria-label="send"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </form>

            <AnimatePresence>
              {scriptsOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/30 z-[62]"
                    onClick={() => setScriptsOpen(false)}
                  />
                  <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                    className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-900 rounded-t-2xl shadow-2xl z-[63] max-h-[70%] flex flex-col"
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                      <h4 className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                        <BookText className="w-4 h-4 text-indigo-500" />
                        최근 사용 스크립트
                      </h4>
                      <button
                        onClick={() => setScriptsOpen(false)}
                        className="text-slate-400 hover:text-slate-600 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                      {scriptsLoading ? (
                        <div className="text-center py-6 text-sm text-slate-400">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                        </div>
                      ) : scripts.length === 0 ? (
                        <p className="text-center py-6 text-sm text-slate-400">
                          저장된 스크립트가 없어요.
                        </p>
                      ) : (
                        scripts.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => insertScript(s)}
                            className="block w-full text-left p-3 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 border border-slate-100 dark:border-slate-700 rounded-xl transition-colors"
                          >
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                              {s.title}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                              {s.content}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-1">
                              {s.use_count}회 사용 · {s.category}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
