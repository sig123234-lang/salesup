'use client'

import { useState } from 'react'
import { ClipboardCopy, Download, FileText, Loader2, Sparkles, Check } from 'lucide-react'

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

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function DailyReportWidget() {
  const [date, setDate] = useState(todayKey())
  const [report, setReport] = useState<DailyReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const generate = async () => {
    setLoading(true)
    setError(null)
    setReport(null)
    const res = await fetch('/api/ai/daily-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(json.error || '일지 생성 실패')
      return
    }
    setReport(json.data as DailyReport)
  }

  const copy = async () => {
    if (!report) return
    await navigator.clipboard.writeText(report.markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const download = () => {
    if (!report) return
    const blob = new Blob([report.markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `salesup-report-${report.date}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-slate-700 gap-2 flex-wrap">
        <h3 className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
          <FileText className="w-4 h-4 text-purple-500" />
          영업 일지 자동 생성
        </h3>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={todayKey()}
            className="px-2 py-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={generate}
            disabled={loading}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded-lg flex items-center gap-1 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            일지 생성
          </button>
        </div>
      </div>

      <div className="p-4">
        {!report && !loading && (
          <div className="py-6 text-center text-sm text-slate-500">
            날짜를 선택하고 [일지 생성]을 누르면 AI가 활동을 자동 정리해드려요.
          </div>
        )}

        {loading && (
          <div className="py-8 text-center">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-purple-500" />
            <p className="text-sm text-slate-500 mt-2">AI가 오늘 활동을 분석 중...</p>
          </div>
        )}

        {error && (
          <p className="text-sm text-rose-600 dark:text-rose-300 py-3">{error}</p>
        )}

        {report && (
          <div className="space-y-4">
            <div className="rounded-xl bg-purple-50 dark:bg-purple-950/30 px-3 py-2.5">
              <p className="text-sm text-purple-900 dark:text-purple-200 font-medium">
                {report.summary}
              </p>
              {report.highlights.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {report.highlights.map((h, i) => (
                    <li
                      key={i}
                      className="text-xs text-purple-700 dark:text-purple-300 flex items-start gap-1"
                    >
                      <span className="text-purple-400">✦</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-3">
              {report.sections.map((s, i) => (
                <div key={i}>
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                    {s.title}
                  </h4>
                  <ul className="space-y-1 pl-2">
                    {s.items.map((item, j) => (
                      <li
                        key={j}
                        className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1"
                      >
                        <span className="text-slate-300">·</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={copy}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3" />
                    복사됨
                  </>
                ) : (
                  <>
                    <ClipboardCopy className="w-3 h-3" />
                    복사
                  </>
                )}
              </button>
              <button
                onClick={download}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg"
              >
                <Download className="w-3 h-3" />
                다운로드
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
