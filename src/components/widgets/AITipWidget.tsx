'use client'

import { Brain, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface AITipWidgetProps {
  pendingFollowups: number
}

export function AITipWidget({ pendingFollowups }: AITipWidgetProps) {
  return (
    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-4 text-white shadow-lg shadow-blue-500/20">
      <div className="flex items-center gap-2 mb-2">
        <Brain className="w-4 h-4" />
        <span className="text-sm font-semibold">AI 추천</span>
      </div>
      <p className="text-sm text-blue-100 leading-relaxed">
        {pendingFollowups > 0
          ? `오늘 연락 예정인 고객이 ${pendingFollowups}명 있습니다. 후속 연락을 통해 계약 가능성을 높여보세요.`
          : '모든 후속 연락이 완료됐어요. AI 인사이트에서 다음 전략을 확인해보세요.'}
      </p>
      <Link href="/ai-insights">
        <button className="mt-3 text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
          인사이트 보기 <ArrowRight className="w-3 h-3" />
        </button>
      </Link>
    </div>
  )
}
