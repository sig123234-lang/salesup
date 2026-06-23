import type { CalendarEvent, CalendarEventSource } from '@/types'

export const EVENT_TYPE_COLORS: Record<CalendarEvent['type'], string> = {
  CALL: 'bg-blue-500',
  VISIT: 'bg-green-500',
  MEETING: 'bg-purple-500',
  FOLLOW_UP: 'bg-amber-500',
  OTHER: 'bg-slate-400',
}

export interface SourceStyle {
  icon: string
  ringClass: string
  badge: string
  reason: string
}

export function sourceStyle(event: Pick<CalendarEvent, 'source' | 'is_ai_generated'>): SourceStyle | null {
  const source = (event.source ?? null) as CalendarEventSource | null
  switch (source) {
    case 'cs_reminder':
      return {
        icon: '❤️',
        ringClass: 'ring-2 ring-pink-400/60 ring-dashed',
        badge: 'CS 리마인더',
        reason: '계약 완료 고객 주기 관리 일정',
      }
    case 'followup_sequence':
      return {
        icon: '🔄',
        ringClass: 'ring-2 ring-blue-400/60 ring-dashed',
        badge: '팔로업 시퀀스',
        reason: '연구 기반 팔로업 단계 일정',
      }
    case 'ai_analysis':
      return {
        icon: '🤖',
        ringClass: 'ring-2 ring-indigo-400/60 ring-dashed',
        badge: 'AI 통화 분석',
        reason: '통화 분석에서 추출된 다음 일정',
      }
    case 'ai_recommendation':
      return {
        icon: '✨',
        ringClass: 'ring-2 ring-violet-400/60 ring-dashed',
        badge: 'AI 추천',
        reason: 'AI 영업 추천에 따른 일정',
      }
    default:
      if (event.is_ai_generated) {
        return {
          icon: '🤖',
          ringClass: 'ring-2 ring-indigo-400/60 ring-dashed',
          badge: 'AI 생성',
          reason: 'AI가 자동 생성한 일정',
        }
      }
      return null
  }
}
