'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store'
import { Profile } from '@/types'

export function useAuth() {
  const { profile, setProfile } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  const readProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, company:companies(*)')
        .eq('id', user.id)
        .single()

      if (data) {
        setProfile(data as Profile)
      } else {
        const { data: basicProfile } = await supabase
          .from('profiles')
          .select('id, full_name, role, created_at, updated_at')
          .eq('id', user.id)
          .maybeSingle()

        if (basicProfile) {
          setProfile({
            id: basicProfile.id,
            email: user.email || '',
            full_name: basicProfile.full_name || user.user_metadata?.full_name || '',
            role: basicProfile.role,
            company_id: null,
            avatar_url: null,
            phone: null,
            username: null,
            created_at: basicProfile.created_at,
            updated_at: basicProfile.updated_at,
          } as Profile)
        } else if (error) {
          setProfile({
            id: user.id,
            email: user.email || '',
            full_name: user.user_metadata?.full_name || '',
            role: (user.user_metadata?.role || 'PERSONAL_USER') as Profile['role'],
            company_id: null,
            avatar_url: null,
            phone: null,
            username: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        }
      }
    } else {
      setProfile(null)
    }

    setLoading(false)
  }, [setProfile, supabase])

  const refreshProfile = useCallback(async () => {
    setLoading(true)
    await readProfile()
  }, [readProfile])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void readProfile()
    }, 0)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setProfile(null)
      } else if (session?.user) {
        await refreshProfile()
      }
    })

    return () => {
      window.clearTimeout(timer)
      subscription.unsubscribe()
    }
  }, [readProfile, refreshProfile, setProfile, supabase])

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  const isAdmin = profile?.role === 'COMPANY_ADMIN' || profile?.role === 'SUPER_ADMIN'
  const isMember = profile?.role === 'SALES_MEMBER'
  const isPersonal = profile?.role === 'PERSONAL_USER'

  return { profile, loading, signOut, isAdmin, isMember, isPersonal, refreshProfile }
}
