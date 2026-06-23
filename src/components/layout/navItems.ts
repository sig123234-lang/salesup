import {
  LayoutDashboard,
  Users,
  Building2,
  Kanban,
  Calendar,
  Map,
  Phone,
  Navigation,
  Brain,
  AlertTriangle,
  BarChart3,
  BookText,
  type LucideIcon,
} from 'lucide-react'
import { NavItemConfig } from '@/types'

export interface NavItem {
  id: string
  href: string
  icon: LucideIcon
  label: string
  admin?: boolean
  exact?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { id: '/dashboard', href: '/dashboard', icon: LayoutDashboard, label: '대시보드', exact: true },
  { id: '/clients', href: '/clients', icon: Users, label: '거래처' },
  { id: '/kanban', href: '/kanban', icon: Kanban, label: '영업 현황' },
  { id: '/calendar', href: '/calendar', icon: Calendar, label: '캘린더' },
  { id: '/map', href: '/map', icon: Map, label: '지도' },
  { id: '/calls', href: '/calls', icon: Phone, label: '통화 기록' },
  { id: '/visits', href: '/visits', icon: Navigation, label: '방문 기록' },
  { id: '/scripts', href: '/scripts', icon: BookText, label: '스크립트' },
  { id: '/ai-insights', href: '/ai-insights', icon: Brain, label: 'AI 인사이트' },
  { id: '/claims', href: '/claims', icon: AlertTriangle, label: '클레임' },
  { id: '/admin/dashboard', href: '/admin/dashboard', icon: BarChart3, label: '관리자 현황', admin: true },
  { id: '/company', href: '/company', icon: Building2, label: '회사 정보', admin: true },
  { id: '/admin/members', href: '/admin/members', icon: Users, label: '멤버 관리', admin: true },
  { id: '/admin/analytics', href: '/admin/analytics', icon: Brain, label: 'AI 리포트', admin: true },
]

export const DEFAULT_NAV_CONFIG: NavItemConfig[] = NAV_ITEMS.map((item) => ({
  id: item.id,
  enabled: true,
}))

export const NAV_ITEM_BY_ID: Record<string, NavItem> = Object.fromEntries(
  NAV_ITEMS.map((item) => [item.id, item])
)
