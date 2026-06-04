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
import { X, GripVertical, Columns } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { KanbanColumnConfig, SalesStatus } from '@/types'
import { SALES_STATUS_CONFIG } from '@/lib/utils'

interface SortableColumnItemProps {
  col: KanbanColumnConfig
  onToggle: (id: SalesStatus) => void
}

function SortableColumnItem({ col, onToggle }: SortableColumnItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: col.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const cfg = SALES_STATUS_CONFIG[col.id]

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

      <span className="text-base flex-shrink-0">{cfg.emoji}</span>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</p>
      </div>

      <button
        onClick={() => onToggle(col.id)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
          col.enabled ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            col.enabled ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}

interface KanbanConfigModalProps {
  columns: KanbanColumnConfig[]
  onToggle: (id: SalesStatus) => void
  onReorder: (next: KanbanColumnConfig[]) => void
  onClose: () => void
}

export function KanbanConfigModal({
  columns,
  onToggle,
  onReorder,
  onClose,
}: KanbanConfigModalProps) {
  const [localCols, setLocalCols] = useState(columns)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = localCols.findIndex((c) => c.id === active.id)
    const newIndex = localCols.findIndex((c) => c.id === over.id)
    const next = arrayMove(localCols, oldIndex, newIndex)
    setLocalCols(next)
    onReorder(next)
  }

  function handleToggle(id: SalesStatus) {
    const next = localCols.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    setLocalCols(next)
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
          className="w-full max-w-sm bg-slate-50 dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Columns className="w-4 h-4 text-blue-500" />
              <h2 className="font-semibold text-slate-900 dark:text-white">칸반 컬럼 설정</h2>
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
              보여줄 컬럼을 선택하고 드래그로 순서를 바꿔보세요
            </p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={localCols.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {localCols.map((col) => (
                    <SortableColumnItem key={col.id} col={col} onToggle={handleToggle} />
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
