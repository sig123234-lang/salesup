'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import { KanbanColumnConfig, DEFAULT_KANBAN_CONFIG, SalesStatus } from '@/types'

export function useKanbanConfig() {
  const { profile } = useAuth()
  const supabase = createClient()
  const [columns, setColumns] = useState<KanbanColumnConfig[]>(DEFAULT_KANBAN_CONFIG)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    const saved = (profile as { metadata?: { kanban_columns?: KanbanColumnConfig[] } })
      .metadata?.kanban_columns

    if (saved && saved.length > 0) {
      const savedIds = new Set(saved.map((c) => c.id))
      const merged = [
        ...saved,
        ...DEFAULT_KANBAN_CONFIG.filter((c) => !savedIds.has(c.id)),
      ]
      setColumns(merged)
    }
    setLoading(false)
  }, [profile])

  const saveColumns = useCallback(
    async (next: KanbanColumnConfig[]) => {
      if (!profile) return
      setColumns(next)
      const currentMeta =
        (profile as { metadata?: Record<string, unknown> }).metadata ?? {}
      await supabase
        .from('profiles')
        .update({ metadata: { ...currentMeta, kanban_columns: next } })
        .eq('id', profile.id)
    },
    [profile, supabase]
  )

  const toggleColumn = useCallback(
    (id: SalesStatus) => {
      const next = columns.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
      void saveColumns(next)
    },
    [columns, saveColumns]
  )

  const reorderColumns = useCallback(
    (next: KanbanColumnConfig[]) => {
      void saveColumns(next)
    },
    [saveColumns]
  )

  const enabledColumns = columns.filter((c) => c.enabled)

  return { columns, enabledColumns, loading, toggleColumn, reorderColumns }
}
