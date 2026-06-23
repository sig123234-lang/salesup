'use client'

import { useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import { useAuthStore } from '@/store'
import { WidgetConfig, DEFAULT_WIDGET_CONFIG, WidgetId, Profile } from '@/types'

function mergeWidgets(saved: WidgetConfig[] | undefined | null): WidgetConfig[] {
  if (!saved || saved.length === 0) return DEFAULT_WIDGET_CONFIG
  const savedIds = new Set(saved.map((w) => w.id))
  return [
    ...saved,
    ...DEFAULT_WIDGET_CONFIG.filter((w) => !savedIds.has(w.id)),
  ]
}

export function useDashboardConfig() {
  const { profile } = useAuth()
  const setProfile = useAuthStore((s) => s.setProfile)
  const supabase = createClient()

  const widgets = useMemo<WidgetConfig[]>(() => {
    const saved = (profile as { metadata?: { dashboard_widgets?: WidgetConfig[] } } | null)
      ?.metadata?.dashboard_widgets
    return mergeWidgets(saved)
  }, [profile])

  const loading = profile === null

  const saveWidgets = useCallback(
    async (next: WidgetConfig[]) => {
      if (!profile) return
      const currentMeta =
        (profile as { metadata?: Record<string, unknown> }).metadata ?? {}
      const updatedMeta = { ...currentMeta, dashboard_widgets: next }
      // Optimistic store update so derived useMemo emits immediately
      setProfile({ ...(profile as Profile), metadata: updatedMeta } as Profile)
      await supabase.from('profiles').update({ metadata: updatedMeta }).eq('id', profile.id)
    },
    [profile, setProfile, supabase],
  )

  const toggleWidget = useCallback(
    (id: WidgetId) => {
      const next = widgets.map((w) =>
        w.id === id ? { ...w, enabled: !w.enabled } : w,
      )
      void saveWidgets(next)
    },
    [widgets, saveWidgets],
  )

  const reorderWidgets = useCallback(
    (next: WidgetConfig[]) => {
      void saveWidgets(next)
    },
    [saveWidgets],
  )

  const enabledWidgets = useMemo(() => widgets.filter((w) => w.enabled), [widgets])

  return { widgets, enabledWidgets, loading, toggleWidget, reorderWidgets }
}
