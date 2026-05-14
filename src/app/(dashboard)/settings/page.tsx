'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Building2,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Save,
  Shield,
  Sun,
  User,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { useUIStore } from '@/store'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const { profile, signOut, refreshProfile } = useAuth()
  const { theme, setTheme } = useUIStore()

  if (!profile) {
    return null
  }

  return (
    <SettingsContent
      key={profile.id}
      profile={profile}
      routerPush={async () => {
        await signOut()
        router.replace('/login')
        router.refresh()
      }}
      refreshProfile={refreshProfile}
      supabase={supabase}
      theme={theme}
      setTheme={setTheme}
    />
  )
}

type SettingsContentProps = {
  profile: NonNullable<ReturnType<typeof useAuth>['profile']>
  routerPush: () => Promise<void>
  refreshProfile: () => Promise<void>
  supabase: ReturnType<typeof createClient>
  theme: 'light' | 'dark' | 'system'
  setTheme: (theme: 'light' | 'dark' | 'system') => void
}

function SettingsContent({
  profile,
  routerPush,
  refreshProfile,
  supabase,
  theme,
  setTheme,
}: SettingsContentProps) {
  const [profileForm, setProfileForm] = useState({
    fullName: profile.full_name || '',
    username: profile.username || '',
    phone: profile.phone || '',
  })
  const [passwordForm, setPasswordForm] = useState({
    password: '',
    confirmPassword: '',
  })
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()

    setSavingProfile(true)
    setError('')
    setMessage('')

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: profileForm.fullName,
        username: profileForm.username || null,
        phone: profileForm.phone || null,
      })
      .eq('id', profile.id)

    if (updateError) {
      setError(updateError.message)
      setSavingProfile(false)
      return
    }

    await refreshProfile()
    setMessage('프로필이 저장되었습니다.')
    setSavingProfile(false)
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (passwordForm.password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }

    if (passwordForm.password !== passwordForm.confirmPassword) {
      setError('비밀번호 확인이 일치하지 않습니다.')
      return
    }

    setSavingPassword(true)
    const { error: passwordError } = await supabase.auth.updateUser({
      password: passwordForm.password,
    })

    if (passwordError) {
      setError(passwordError.message)
      setSavingPassword(false)
      return
    }

    setPasswordForm({ password: '', confirmPassword: '' })
    setMessage('비밀번호가 변경되었습니다.')
    setSavingPassword(false)
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-6">설정</h1>

      {error && (
        <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      )}
      {message && (
        <p className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-300">
          {message}
        </p>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-5 mb-6 text-white shadow-lg shadow-blue-500/20"
      >
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-bold">
            {profile?.full_name?.[0] || 'U'}
          </div>
          <div>
            <h2 className="font-bold text-lg">{profile?.full_name}</h2>
            <p className="text-blue-200 text-sm">{profile?.email}</p>
            <span className="text-xs bg-white/20 px-2.5 py-0.5 rounded-full mt-1 inline-block">
              {profile?.role === 'COMPANY_ADMIN'
                ? '회사 관리자'
                : profile?.role === 'SALES_MEMBER'
                  ? '영업사원'
                  : profile?.role === 'SUPER_ADMIN'
                    ? '슈퍼 관리자'
                    : '개인 사용자'}
            </span>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4">
        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={saveProfile}
          className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-blue-500" />
            <h3 className="font-semibold text-slate-900 dark:text-white">프로필</h3>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-500 mb-2">이름</label>
              <input
                value={profileForm.fullName}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, fullName: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-2">사용자명</label>
              <input
                value={profileForm.username}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, username: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-2">전화번호</label>
              <input
                value={profileForm.phone}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-2">이메일</label>
              <input
                value={profile?.email || ''}
                disabled
                className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            프로필 저장
          </button>
        </motion.form>

        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          onSubmit={changePassword}
          className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-purple-500" />
            <h3 className="font-semibold text-slate-900 dark:text-white">비밀번호 변경</h3>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-500 mb-2">새 비밀번호</label>
              <input
                type="password"
                value={passwordForm.password}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, password: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-2">새 비밀번호 확인</label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingPassword}
            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-5 py-3 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50"
          >
            {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            비밀번호 변경
          </button>
        </motion.form>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-green-500" />
            <h3 className="font-semibold text-slate-900 dark:text-white">회사</h3>
          </div>

          <p className="text-sm text-slate-500 mb-4">
            {profile?.company_id
              ? '회사 정보와 소속 멤버를 관리합니다.'
              : '아직 소속된 회사가 없습니다. 회사 페이지에서 새 회사를 만들 수 있습니다.'}
          </p>

          <Link
            href="/company"
            className="inline-flex items-center gap-2 rounded-2xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-300"
          >
            <Building2 className="w-4 h-4" />
            {profile?.company_id ? '회사 페이지 열기' : '회사 만들기'}
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm"
        >
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3 text-sm">테마</h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'light', icon: Sun, label: '라이트' },
              { value: 'dark', icon: Moon, label: '다크' },
              { value: 'system', icon: Monitor, label: '시스템' },
            ].map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => setTheme(value as 'light' | 'dark' | 'system')}
                className={cn(
                  'flex flex-col items-center gap-2 py-3 rounded-xl text-sm font-medium transition-all',
                  theme === value
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                )}
              >
                <Icon className="w-5 h-5" />
                {label}
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      <button
        onClick={routerPush}
        className="w-full mt-6 py-3.5 bg-red-50 dark:bg-red-950 text-red-600 rounded-2xl font-medium flex items-center justify-center gap-2 hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
      >
        <LogOut className="w-5 h-5" />
        로그아웃
      </button>
    </div>
  )
}
