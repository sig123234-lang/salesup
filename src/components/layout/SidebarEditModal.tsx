'use client'

import { Menu } from 'lucide-react'
import { ConfigSortModal, ConfigItemMeta } from '@/components/ui/ConfigSortModal'
import { NavItemConfig } from '@/types'
import { NAV_ITEMS, NAV_ITEM_BY_ID } from './navItems'

interface Props {
  items: NavItemConfig[]
  isAdmin: boolean
  onToggle: (id: string) => void
  onReorder: (next: NavItemConfig[]) => void
  onClose: () => void
}

const NAV_META: Record<string, ConfigItemMeta> = Object.fromEntries(
  NAV_ITEMS.map((item) => [
    item.id,
    { name: item.label, description: item.admin ? '관리자 메뉴' : item.href },
  ])
)

export function SidebarEditModal({ items, isAdmin, onToggle, onReorder, onClose }: Props) {
  const visibleItems = isAdmin
    ? items
    : items.filter((it) => !NAV_ITEM_BY_ID[it.id]?.admin)

  const handleReorder = (next: NavItemConfig[]) => {
    if (isAdmin) {
      onReorder(next)
      return
    }
    const hidden = items.filter((it) => NAV_ITEM_BY_ID[it.id]?.admin)
    onReorder([...next, ...hidden])
  }

  return (
    <ConfigSortModal
      title="사이드바 편집"
      icon={Menu}
      description="모바일 하단 메뉴에는 켜진 메뉴 중 위에서 5개만 표시돼요"
      items={visibleItems}
      itemMeta={NAV_META}
      onToggle={onToggle}
      onReorder={handleReorder}
      onClose={onClose}
    />
  )
}
