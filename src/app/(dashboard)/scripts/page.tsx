'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookText,
  Plus,
  Sparkles,
  Search,
  ClipboardCopy,
  Pencil,
  Trash2,
  Users,
  X,
  Loader2,
  Check,
} from 'lucide-react'
import { useAIChatStore } from '@/store'
import { cn } from '@/lib/utils'

type Category =
  | 'all'
  | 'followup_call'
  | 'followup_text'
  | 'intro'
  | 'objection'
  | 'closing'
  | 'cs'
  | 'general'

interface Script {
  id: string
  user_id: string
  company_id: string | null
  title: string
  content: string
  category: Exclude<Category, 'all'>
  tags: string[]
  use_count: number
  is_shared: boolean
  ownership: 'mine' | 'shared'
  created_at: string
  updated_at: string
}

const CATEGORIES: Array<{ id: Category; label: string; emoji: string }> = [
  { id: 'all', label: '전체', emoji: '📚' },
  { id: 'followup_call', label: '팔로업 전화', emoji: '📞' },
  { id: 'followup_text', label: '팔로업 문자', emoji: '💌' },
  { id: 'intro', label: '소개', emoji: '👋' },
  { id: 'objection', label: '반론 처리', emoji: '🛡️' },
  { id: 'closing', label: '클로징', emoji: '🤝' },
  { id: 'cs', label: 'CS', emoji: '❤️' },
  { id: 'general', label: '기타', emoji: '✨' },
]

export default function ScriptsPage() {
  const [scripts, setScripts] = useState<Script[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<Category>('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Script | null>(null)
  const [creating, setCreating] = useState(false)
  const [aiAsking, setAiAsking] = useState(false)
  const { open: openChat, addMessage } = useAIChatStore()

  const load = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (category !== 'all') params.set('category', category)
    if (search.trim()) params.set('q', search.trim())
    const res = await fetch(`/api/scripts?${params}`, { cache: 'no-store' })
    const json = await res.json()
    setScripts(((json.data ?? []) as Script[]) || [])
    setLoading(false)
  }

  const [lastLoadedCategory, setLastLoadedCategory] = useState<Category | null>(null)
  if (lastLoadedCategory !== category) {
    setLastLoadedCategory(category)
    void load()
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return scripts
    return scripts.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.content.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }, [scripts, search])

  const copyScript = async (s: Script) => {
    await navigator.clipboard.writeText(s.content)
    await fetch(`/api/scripts/${s.id}`, { method: 'POST' })
    setScripts((prev) =>
      prev.map((x) => (x.id === s.id ? { ...x, use_count: x.use_count + 1 } : x)),
    )
  }

  const askAI = () => {
    setAiAsking(true)
    openChat()
    addMessage({
      id: `script-help-${Date.now()}`,
      role: 'user',
      content: `자주 쓸 만한 영업 스크립트를 한 가지 작성해줘. 카테고리: ${
        CATEGORIES.find((c) => c.id === category)?.label ?? '일반'
      }. 30초~1분 분량의 자연스러운 한국어 멘트로.`,
      created_at: new Date().toISOString(),
    })
    setTimeout(() => setAiAsking(false), 600)
  }

  const remove = async (id: string) => {
    if (!confirm('이 스크립트를 삭제할까요?')) return
    const res = await fetch(`/api/scripts/${id}`, { method: 'DELETE' })
    if (res.ok) setScripts((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <BookText className="w-5 h-5 text-indigo-500" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">스크립트 라이브러리</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={askAI}
            disabled={aiAsking}
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-sm font-medium rounded-xl hover:bg-purple-100"
          >
            <Sparkles className="w-4 h-4" />
            AI에게 작성 요청
          </button>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl"
          >
            <Plus className="w-4 h-4" />새 스크립트
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-full transition-colors flex items-center gap-1',
              category === c.id
                ? 'bg-indigo-600 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-300',
            )}
          >
            <span>{c.emoji}</span>
            {c.label}
          </button>
        ))}
      </div>

      <div className="relative mb-5">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="제목, 내용, 태그 검색..."
          className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-28 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-400">
          <BookText className="w-10 h-10 mx-auto mb-2 opacity-30" />
          {search ? '검색 결과가 없어요.' : '아직 저장된 스크립트가 없어요. 새 스크립트를 추가해보세요.'}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map((s) => {
            const cat = CATEGORIES.find((c) => c.id === s.category)
            return (
              <div
                key={s.id}
                className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 shadow-sm flex flex-col"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {s.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full">
                        {cat?.emoji} {cat?.label}
                      </span>
                      {s.is_shared && (
                        <span className="text-[10px] bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <Users className="w-2.5 h-2.5" />팀
                        </span>
                      )}
                      {s.ownership === 'shared' && (
                        <span className="text-[10px] bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                          🤝 공유받음
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400">
                        · {s.use_count}회 사용
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3 mb-3 flex-1 whitespace-pre-line">
                  {s.content}
                </p>
                {s.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {s.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded-full"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-1 pt-2 border-t border-slate-50 dark:border-slate-700/50">
                  <button
                    onClick={() => copyScript(s)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg"
                  >
                    <ClipboardCopy className="w-3 h-3" />복사
                  </button>
                  {s.ownership === 'mine' && (
                    <>
                      <button
                        onClick={() => setEditing(s)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg"
                      >
                        <Pencil className="w-3 h-3" />수정
                      </button>
                      <button
                        onClick={() => remove(s.id)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                      >
                        <Trash2 className="w-3 h-3" />삭제
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {(editing || creating) && (
          <ScriptEditor
            initial={editing}
            onClose={() => {
              setEditing(null)
              setCreating(false)
            }}
            onSaved={() => {
              setEditing(null)
              setCreating(false)
              void load()
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function ScriptEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: Script | null
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [content, setContent] = useState(initial?.content ?? '')
  const [category, setCategory] = useState<Exclude<Category, 'all'>>(
    initial?.category ?? 'general',
  )
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '))
  const [isShared, setIsShared] = useState(initial?.is_shared ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setSaving(true)
    setError(null)
    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    const url = initial ? `/api/scripts/${initial.id}` : '/api/scripts'
    const method = initial ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, category, tags: tagList, is_shared: isShared }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(json.error || '저장 실패')
      return
    }
    onSaved()
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        className="fixed inset-x-4 top-10 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl z-50 overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            {initial ? '스크립트 수정' : '새 스크립트'}
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목"
            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Exclude<Category, 'all'>)}
            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.label}
              </option>
            ))}
          </select>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="스크립트 내용..."
            rows={6}
            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="태그 (쉼표로 구분)"
            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={isShared}
              onChange={(e) => setIsShared(e.target.checked)}
              className="w-4 h-4"
            />
            <Users className="w-4 h-4 text-amber-500" />팀에 공유
          </label>
          {error && <p className="text-xs text-rose-600 dark:text-rose-300">{error}</p>}
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={save}
            disabled={saving || !title.trim() || !content.trim()}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-1 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            저장
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm rounded-xl"
          >
            취소
          </button>
        </div>
      </motion.div>
    </>
  )
}
