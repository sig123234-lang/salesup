import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { SalesStatus } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const SALES_STATUS_CONFIG: Record<
  SalesStatus,
  { label: string; color: string; bg: string; border: string; emoji: string }
> = {
  NEW_LEAD: {
    label: '신규 리드',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    emoji: '🌱',
  },
  FIRST_VISIT: {
    label: '첫 방문 완료',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    emoji: '👣',
  },
  QUOTE_SENT: {
    label: '견적 전달',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    emoji: '📋',
  },
  FOLLOW_UP: {
    label: '연락 예정',
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    emoji: '📞',
  },
  CONTRACT_IN_PROGRESS: {
    label: '계약 진행중',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    emoji: '🤝',
  },
  CONTRACTED: {
    label: '계약 완료',
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    emoji: '✅',
  },
  REJECTED: {
    label: '거절',
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    emoji: '❌',
  },
  POTENTIAL: {
    label: '잠재 고객',
    color: 'text-teal-600',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    emoji: '💡',
  },
}

export function formatDate(dateString: string | null, options?: Intl.DateTimeFormatOptions): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options,
  })
}

export function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return '기록 없음'
  const now = new Date()
  const date = new Date(dateString)
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor(diff / (1000 * 60))

  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  if (hours < 24) return `${hours}시간 전`
  if (days < 7) return `${days}일 전`
  return formatDate(dateString)
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function getProbabilityColor(prob: number): string {
  if (prob >= 70) return 'text-green-600'
  if (prob >= 40) return 'text-yellow-600'
  return 'text-red-500'
}

export function getProbabilityBg(prob: number): string {
  if (prob >= 70) return 'bg-green-500'
  if (prob >= 40) return 'bg-yellow-500'
  return 'bg-red-500'
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
