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
import { X, GripVertical, LayoutDashboard, LucideIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ConfigItem } from '@/lib/hooks/useViewConfig'

export interface ConfigItemMeta {
  name: string
  description?: string
  emoji?: string
  nameClass?: string
}

interface SortableRowProps<TId extends string> {
  item: ConfigItem<TId>
  meta: ConfigItemMeta
  onToggle: (id: TId) => void
}

function SortableRow<TId extends string>({ item, meta, onToggle }: SortableRowProps<TId>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

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

      {meta.emoji && <span className="text-base flex-shrink-0">{meta.emoji}</span>}

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${meta.nameClass ?? 'text-slate-900 dark:text-white'}`}>
          {meta.name}
        </p>
        {meta.description && (
          <p className="text-xs text-slate-400 truncate">{meta.description}</p>
        )}
      </div>

      <button
        onClick={() => onToggle(item.id)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
          item.enabled ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            item.enabled ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}

interface ConfigSortModalProps<TId extends string> {
  title: string
  icon?: LucideIcon
  description?: string
  items: ConfigItem<TId>[]
  itemMeta: Record<TId, ConfigItemMeta>
  onToggle: (id: TId) => void
  onReorder: (next: ConfigItem<TId>[]) => void
  onClose: () => void
}

export function ConfigSortModal<TId extends string>({
  title,
  icon: Icon = LayoutDashboard,
  description = '드래그로 순서를 바꾸고 토글로 켜거나 끌 수 있어요',
  items,
  itemMeta,
  onToggle,
  onReorder,
  onClose,
}: ConfigSortModalProps<TId>) {
  const [local, setLocal] = useState(items)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = local.findIndex((it) => it.id === active.id)
    const newIndex = local.findIndex((it) => it.id === over.id)
    const next = arrayMove(local, oldIndex, newIndex)
    setLocal(next)
    onReorder(next)
  }

  function handleToggle(id: TId) {
    const next = local.map((it) => (it.id === id ? { ...it, enabled: !it.enabled } : it))
    setLocal(next)
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
              <Icon className="w-4 h-4 text-blue-500" />
              <h2 className="font-semibold text-slate-900 dark:text-white">{title}</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          <div className="p-4 max-h-[60vh] overflow-y-auto">
            <p className="text-xs text-slate-400 mb-4 text-center">{description}</p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={local.map((it) => it.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {local.map((item) => (
                    <SortableRow
                      key={item.id}
                      item={item}
                      meta={itemMeta[item.id]}
                      onToggle={handleToggle}
                    />
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
