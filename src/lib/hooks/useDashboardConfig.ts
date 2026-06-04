'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import { WidgetConfig, DEFAULT_WIDGET_CONFIG, WidgetId } from '@/types'

export function useDashboardConfig() {
  const { profile } = useAuth()
  const supabase = createClient()
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGET_CONFIG)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    const saved = (profile as { metadata?: { dashboard_widgets?: WidgetConfig[] } })
      .metadata?.dashboard_widgets

    if (saved && saved.length > 0) {
      // Merge: keep saved order/enabled state, add any new widgets from DEFAULT not in saved
      const savedIds = new Set(saved.map((w) => w.id))
      const merged = [
        ...saved,
        ...DEFAULT_WIDGET_CONFIG.filter((w) => !savedIds.has(w.id)),
      ]
      setWidgets(merged)
    }
    setLoading(false)
  }, [profile])

  const saveWidgets = useCallback(
    async (next: WidgetConfig[]) => {
      if (!profile) return
      setWidgets(next)

      const currentMeta =
        (profile as { metadata?: Record<string, unknown> }).metadata ?? {}
      await supabase
        .from('profiles')
        .update({ metadata: { ...currentMeta, dashboard_widgets: next } })
        .eq('id', profile.id)
    },
    [profile, supabase]
  )

  const toggleWidget = useCallback(
    (id: WidgetId) => {
      const next = widgets.map((w) =>
        w.id === id ? { ...w, enabled: !w.enabled } : w
      )
      void saveWidgets(next)
    },
    [widgets, saveWidgets]
  )

  const reorderWidgets = useCallback(
    (next: WidgetConfig[]) => {
      void saveWidgets(next)
    },
    [saveWidgets]
  )

  const enabledWidgets = widgets.filter((w) => w.enabled)

  return { widgets, enabledWidgets, loading, toggleWidget, reorderWidgets }
}
