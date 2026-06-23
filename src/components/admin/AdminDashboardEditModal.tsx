'use client'

import { LayoutDashboard } from 'lucide-react'
import { ConfigSortModal, ConfigItemMeta } from '@/components/ui/ConfigSortModal'
import { AdminDashboardWidgetConfig, AdminDashboardWidgetId } from '@/types'

interface Props {
  items: AdminDashboardWidgetConfig[]
  onToggle: (id: AdminDashboardWidgetId) => void
  onReorder: (next: AdminDashboardWidgetConfig[]) => void
  onClose: () => void
}

const WIDGET_META: Record<AdminDashboardWidgetId, ConfigItemMeta> = {
  stats: { name: '핵심 지표', description: '멤버 · 거래처 · 전환율 등 6개 카드' },
  'team-members': {
    name: '팀원 현황',
    description: '팀원별 활동/위험 플래그 + AI 코칭 상세',
  },
  'monthly-chart': { name: '월별 계약 현황', description: '최근 6개월 라인 차트' },
  'status-pie': { name: '영업 상태 분포', description: '단계별 거래처 파이 차트' },
  'member-activity': { name: '멤버별 활동 현황', description: '거래처 · 계약 · 통화 · 방문' },
  'top-clients': { name: '고확률 거래처 TOP 5', description: '계약 확률 상위 5건' },
}

export function AdminDashboardEditModal({ items, onToggle, onReorder, onClose }: Props) {
  return (
    <ConfigSortModal
      title="관리자 대시보드 편집"
      icon={LayoutDashboard}
      items={items}
      itemMeta={WIDGET_META}
      onToggle={onToggle}
      onReorder={onReorder}
      onClose={onClose}
    />
  )
}
