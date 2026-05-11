'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store'
import { Profile } from '@/types'

export function useAuth() {
  const { profile, setProfile } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*, company:companies(*)')
          .eq('id', user.id)
          .single()
        if (data) setProfile(data as Profile)
      } else {
        setProfile(null)
      }
      setLoading(false)
    }

    fetchProfile()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setProfile(null)
      } else if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('*, company:companies(*)')
          .eq('id', session.user.id)
          .single()
        if (data) setProfile(data as Profile)
      }
    })

    return () => subscription.unsubscribe()
  }, [setProfile, supabase])

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  const isAdmin = profile?.role === 'COMPANY_ADMIN' || profile?.role === 'SUPER_ADMIN'
  const isMember = profile?.role === 'SALES_MEMBER'
  const isPersonal = profile?.role === 'PERSONAL_USER'

  return { profile, loading, signOut, isAdmin, isMember, isPersonal }
}
