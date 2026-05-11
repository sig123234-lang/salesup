'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Plus, Eye, EyeOff, Copy, Check, Loader2, UserCheck, UserX } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { Profile } from '@/types'

export default function MembersPage() {
  const { profile, isAdmin } = useAuth()
  const supabase = createClient()

  const [members, setMembers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newMember, setNewMember] = useState({ fullName: '', email: '', username: '' })
  const [createdCredential, setCreatedCredential] = useState<{ email: string; password: string } | null>(null)
  const [createError, setCreateError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)

  async function loadMembers() {
    if (!profile?.company_id) return
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('company_id', profile!.company_id)
      .order('created_at', { ascending: false })
    setMembers((data || []) as Profile[])
    setLoading(false)
  }

  useEffect(() => {
    if (!profile?.company_id || !isAdmin) return
    const companyId = profile.company_id

    let cancelled = false

    async function fetchMembers() {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })

      if (cancelled) return

      setMembers((data || []) as Profile[])
      setLoading(false)
    }

    void fetchMembers()

    return () => {
      cancelled = true
    }
  }, [isAdmin, profile, supabase])

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  const createMember = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setCreateError('')
    const password = generatePassword()

    try {
      const res = await fetch('/api/admin/create-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newMember.email,
          password,
          fullName: newMember.fullName,
          companyId: profile!.company_id,
          username: newMember.username,
        }),
      })

      if (!res.ok) {
        const result = await res.json().catch(() => null)
        setCreateError(result?.error || '계정 생성에 실패했습니다.')
        return
      }

      setCreatedCredential({ email: newMember.email, password })
      setNewMember({ fullName: '', email: '', username: '' })
      setShowForm(false)
      await loadMembers()
    } finally {
      setCreating(false)
    }
  }

  const copyCredentials = () => {
    if (!createdCredential) return
    navigator.clipboard.writeText(
      `이메일: ${createdCredential.email}\n비밀번호: ${createdCredential.password}`
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleActive = async (memberId: string, isActive: boolean) => {
    await supabase.from('profiles').update({ is_active: !isActive }).eq('id', memberId)
    await loadMembers()
  }

  if (!isAdmin) {
    return <div className="p-8 text-center text-slate-500">관리자 권한이 필요합니다.</div>
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">멤버 관리</h1>
          <p className="text-sm text-slate-500">영업팀 계정 생성 및 관리</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
          멤버 추가
        </button>
      </div>

      {/* Credential result */}
      <AnimatePresence>
        {createdCredential && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 rounded-2xl p-4 mb-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <UserCheck className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold text-green-800 dark:text-green-300">계정 생성 완료!</h3>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-3 font-mono text-sm space-y-1 mb-3">
              <p className="text-slate-700 dark:text-slate-300">📧 {createdCredential.email}</p>
              <div className="flex items-center gap-2">
                <p className="text-slate-700 dark:text-slate-300 flex-1">
                  🔑 {showPassword ? createdCredential.password : '••••••••••'}
                </p>
                <button onClick={() => setShowPassword(!showPassword)} className="text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyCredentials}
                className="flex-1 py-2 bg-green-600 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-green-500 transition-colors"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? '복사됨!' : '계정 정보 복사'}
              </button>
              <button
                onClick={() => setCreatedCredential(null)}
                className="px-4 py-2 bg-white dark:bg-slate-700 border border-green-200 dark:border-green-900 text-slate-600 dark:text-slate-400 rounded-xl text-sm hover:bg-slate-50 transition-colors"
              >
                닫기
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            onSubmit={createMember}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 mb-5 shadow-sm space-y-3"
          >
            <h2 className="font-semibold text-slate-900 dark:text-white">새 멤버 추가</h2>
            <p className="text-xs text-slate-500">비밀번호는 자동 생성됩니다. 생성 후 전달해주세요.</p>

            {createError && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl px-3 py-2">
                {createError}
              </p>
            )}

            <input
              type="text"
              value={newMember.fullName}
              onChange={(e) => setNewMember((p) => ({ ...p, fullName: e.target.value }))}
              placeholder="이름 *"
              required
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              value={newMember.username}
              onChange={(e) => setNewMember((p) => ({ ...p, username: e.target.value }))}
              placeholder="사용자명 (선택)"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="email"
              value={newMember.email}
              onChange={(e) => setNewMember((p) => ({ ...p, email: e.target.value }))}
              placeholder="이메일 *"
              required
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                계정 생성
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-xl text-sm hover:bg-slate-200 transition-colors"
              >
                취소
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Members list */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-500" />
          <h2 className="font-semibold text-slate-900 dark:text-white">팀 멤버 ({members.length})</h2>
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">멤버가 없습니다</div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {member.full_name?.[0] || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900 dark:text-white text-sm">{member.full_name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      member.role === 'COMPANY_ADMIN'
                        ? 'bg-purple-50 text-purple-600'
                        : 'bg-blue-50 text-blue-600'
                    }`}>
                      {member.role === 'COMPANY_ADMIN' ? '관리자' : '영업사원'}
                    </span>
                    {member.is_active === false && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">비활성</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{member.email}</p>
                </div>
                {member.id !== profile?.id && (
                  <button
                    onClick={() => toggleActive(member.id, member.is_active !== false)}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    title={`${member.is_active !== false ? '비활성화' : '활성화'}`}
                  >
                    {member.is_active !== false ? (
                      <UserCheck className="w-4 h-4 text-green-500" />
                    ) : (
                      <UserX className="w-4 h-4 text-red-400" />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
