'use client'

import { LayoutGrid } from 'lucide-react'
import { ConfigSortModal, ConfigItemMeta } from '@/components/ui/ConfigSortModal'
import { ClientDetailSectionConfig, ClientDetailSectionId } from '@/types'

interface Props {
  items: ClientDetailSectionConfig[]
  onToggle: (id: ClientDetailSectionId) => void
  onReorder: (next: ClientDetailSectionConfig[]) => void
  onClose: () => void
}

const SECTION_META: Record<ClientDetailSectionId, ConfigItemMeta> = {
  info: { name: '거래처 정보', description: '연락처, 메모, 다음 연락 일정' },
  actions: { name: '빠른 액션', description: '전화 · 방문 · 녹음 · 일정' },
  meddic: { name: 'MEDDIC 체크리스트', description: '엔터프라이즈 영업 자격 검증' },
  tabs: { name: '활동 기록', description: '타임라인 · 통화 · 방문 탭' },
}

export function ClientDetailEditModal({ items, onToggle, onReorder, onClose }: Props) {
  return (
    <ConfigSortModal
      title="거래처 화면 편집"
      icon={LayoutGrid}
      items={items}
      itemMeta={SECTION_META}
      onToggle={onToggle}
      onReorder={onReorder}
      onClose={onClose}
    />
  )
}
