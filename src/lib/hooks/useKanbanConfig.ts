'use client'

import { useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import { useAuthStore } from '@/store'
import { KanbanColumnConfig, DEFAULT_KANBAN_CONFIG, SalesStatus, Profile } from '@/types'

function mergeColumns(
  saved: KanbanColumnConfig[] | undefined | null,
): KanbanColumnConfig[] {
  if (!saved || saved.length === 0) return DEFAULT_KANBAN_CONFIG
  const savedIds = new Set(saved.map((c) => c.id))
  return [
    ...saved,
    ...DEFAULT_KANBAN_CONFIG.filter((c) => !savedIds.has(c.id)),
  ]
}

export function useKanbanConfig() {
  const { profile } = useAuth()
  const setProfile = useAuthStore((s) => s.setProfile)
  const supabase = createClient()

  const columns = useMemo<KanbanColumnConfig[]>(() => {
    const saved = (profile as { metadata?: { kanban_columns?: KanbanColumnConfig[] } } | null)
      ?.metadata?.kanban_columns
    return mergeColumns(saved)
  }, [profile])

  const loading = profile === null

  const saveColumns = useCallback(
    async (next: KanbanColumnConfig[]) => {
      if (!profile) return
      const currentMeta =
        (profile as { metadata?: Record<string, unknown> }).metadata ?? {}
      const updatedMeta = { ...currentMeta, kanban_columns: next }
      setProfile({ ...(profile as Profile), metadata: updatedMeta } as Profile)
      await supabase.from('profiles').update({ metadata: updatedMeta }).eq('id', profile.id)
    },
    [profile, setProfile, supabase],
  )

  const toggleColumn = useCallback(
    (id: SalesStatus) => {
      const next = columns.map((c) =>
        c.id === id ? { ...c, enabled: !c.enabled } : c,
      )
      void saveColumns(next)
    },
    [columns, saveColumns],
  )

  const reorderColumns = useCallback(
    (next: KanbanColumnConfig[]) => {
      void saveColumns(next)
    },
    [saveColumns],
  )

  const enabledColumns = useMemo(() => columns.filter((c) => c.enabled), [columns])

  return { columns, enabledColumns, loading, toggleColumn, reorderColumns }
}
