'use client'

import { useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'

export interface ConfigItem<TId extends string> {
  id: TId
  enabled: boolean
}

// Generic per-user on/off + reorder config stored in profiles.metadata[metaKey].
// Pass a module-level `defaults` constant; passing a fresh array each render
// will recompute the memo on every render.
export function useViewConfig<TId extends string>(
  metaKey: string,
  defaults: ConfigItem<TId>[]
) {
  const { profile } = useAuth()
  const supabase = createClient()
  const [override, setOverride] = useState<ConfigItem<TId>[] | null>(null)

  const items = useMemo<ConfigItem<TId>[]>(() => {
    if (override) return override
    if (!profile) return defaults
    const saved = (profile as { metadata?: Record<string, ConfigItem<TId>[] | undefined> })
      .metadata?.[metaKey]
    if (saved && saved.length > 0) {
      const savedIds = new Set(saved.map((it) => it.id))
      return [...saved, ...defaults.filter((it) => !savedIds.has(it.id))]
    }
    return defaults
  }, [profile, metaKey, defaults, override])

  const loading = !profile

  const save = useCallback(
    async (next: ConfigItem<TId>[]) => {
      if (!profile) return
      setOverride(next)
      const currentMeta = (profile as { metadata?: Record<string, unknown> }).metadata ?? {}
      await supabase
        .from('profiles')
        .update({ metadata: { ...currentMeta, [metaKey]: next } })
        .eq('id', profile.id)
    },
    [profile, supabase, metaKey]
  )

  const toggle = useCallback(
    (id: TId) => {
      const next = items.map((it) =>
        it.id === id ? { ...it, enabled: !it.enabled } : it
      )
      void save(next)
    },
    [items, save]
  )

  const reorder = useCallback(
    (next: ConfigItem<TId>[]) => {
      void save(next)
    },
    [save]
  )

  const enabledItems = items.filter((it) => it.enabled)

  return { items, enabledItems, loading, toggle, reorder }
}
