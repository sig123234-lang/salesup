'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { X, GripVertical, LayoutDashboard } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { WidgetConfig, WidgetId } from '@/types'

const WIDGET_META: Record<WidgetId, { name: string; description: string }> = {
  'daily-brief': { name: 'AI 일일 브리핑', description: '오늘 집중할 TOP 3 액션을 AI가 매일 생성' },
  stats: { name: '통계 카드', description: '전체 거래처, 계약 완료 등 핵심 수치' },
  'recent-clients': { name: '최근 거래처', description: '최근 업데이트된 거래처 목록' },
  calendar: { name: '다가오는 일정', description: '예정된 미팅, 방문, 연락 일정' },
  'ai-tip': { name: 'AI 추천', description: 'AI가 분석한 영업 인사이트' },
  'kanban-preview': { name: '영업 파이프라인', description: '단계별 거래처 현황 요약' },
  'followup-alert': { name: '후속 연락 필요', description: '연락 기한이 지난 거래처 알림' },
  'cs-reminder': { name: 'CS 리마인더', description: '계약 완료 고객 주기적 연락 알림' },
  'followup-counter': { name: '오늘의 팔로업 TOP 5', description: '접촉 횟수·확률 기반 우선순위' },
  'goal-tracker': { name: '월간 목표 트래커', description: '계약/통화/방문 목표 달성률 + 추이' },
  'competitor-intel': { name: '경쟁사 인텔리전스', description: '통화에서 언급된 경쟁사 언급량/승률' },
  'daily-report': { name: '오늘 영업 일지', description: 'AI가 오늘 활동을 일지 형태로 자동 정리' },
}

interface SortableItemProps {
  widget: WidgetConfig
  onToggle: (id: WidgetId) => void
}

function SortableItem({ widget, onToggle }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: widget.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const meta = WIDGET_META[widget.id]

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm"
    >
      <button
        className="text-slate-300 dark:text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-white">{meta.name}</p>
        <p className="text-xs text-slate-400 truncate">{meta.description}</p>
      </div>

      <button
        onClick={() => onToggle(widget.id)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
          widget.enabled ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            widget.enabled ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}

interface DashboardEditModalProps {
  widgets: WidgetConfig[]
  onToggle: (id: WidgetId) => void
  onReorder: (next: WidgetConfig[]) => void
  onClose: () => void
}

export function DashboardEditModal({
  widgets,
  onToggle,
  onReorder,
  onClose,
}: DashboardEditModalProps) {
  const [localWidgets, setLocalWidgets] = useState(widgets)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = localWidgets.findIndex((w) => w.id === active.id)
    const newIndex = localWidgets.findIndex((w) => w.id === over.id)
    const next = arrayMove(localWidgets, oldIndex, newIndex)
    setLocalWidgets(next)
    onReorder(next)
  }

  function handleToggle(id: WidgetId) {
    const next = localWidgets.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w))
    setLocalWidgets(next)
    onToggle(id)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          className="w-full max-w-md bg-slate-50 dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4 text-blue-500" />
              <h2 className="font-semibold text-slate-900 dark:text-white">대시보드 편집</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          <div className="p-4">
            <p className="text-xs text-slate-400 mb-4 text-center">
              드래그로 순서를 바꾸고 토글로 위젯을 켜거나 끌 수 있어요
            </p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={localWidgets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {localWidgets.map((widget) => (
                    <SortableItem key={widget.id} widget={widget} onToggle={handleToggle} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <div className="px-4 pb-4">
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              완료
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
