'use client'

import { Brain } from 'lucide-react'
import { ConfigSortModal, ConfigItemMeta } from '@/components/ui/ConfigSortModal'
import { AIInsightsWidgetConfig, AIInsightsWidgetId } from '@/types'

interface Props {
  items: AIInsightsWidgetConfig[]
  onToggle: (id: AIInsightsWidgetId) => void
  onReorder: (next: AIInsightsWidgetConfig[]) => void
  onClose: () => void
}

const WIDGET_META: Record<AIInsightsWidgetId, ConfigItemMeta> = {
  stats: { name: 'AI 통계', description: '평균 계약 확률 · 고확률 · 추천 수' },
  recommendations: { name: '재방문 추천 목록', description: 'AI가 분석한 추천 거래처' },
}

export function AIInsightsEditModal({ items, onToggle, onReorder, onClose }: Props) {
  return (
    <ConfigSortModal
      title="AI 인사이트 편집"
      icon={Brain}
      items={items}
      itemMeta={WIDGET_META}
      onToggle={onToggle}
      onReorder={onReorder}
      onClose={onClose}
    />
  )
}
