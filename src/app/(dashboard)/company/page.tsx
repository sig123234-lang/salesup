'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  BadgeCheck,
  Building2,
  Loader2,
  Save,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import type { Company, Profile } from '@/types'

type CompanyResponse = {
  company: Company | null
  members: Profile[]
  role: Profile['role']
}

const EMPTY_FORM = {
  name: '',
  businessNumber: '',
  logoUrl: '',
  businessLicenseUrl: '',
}

export default function CompanyPage() {
  const { profile, refreshProfile } = useAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [company, setCompany] = useState<Company | null>(null)
  const [members, setMembers] = useState<Profile[]>([])
  const [form, setForm] = useState(EMPTY_FORM)

  const canEditCompany =
    profile?.role === 'COMPANY_ADMIN' || profile?.role === 'SUPER_ADMIN'

  const updateForm = (field: keyof typeof EMPTY_FORM, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const fetchCompanyData = async () => {
    const res = await fetch('/api/company')
    const data = (await res.json().catch(() => null)) as CompanyResponse | { error?: string } | null

    return { res, data }
  }

  const loadCompany = async () => {
    setLoading(true)
    setError('')

    const { res, data } = await fetchCompanyData()

    if (!res.ok) {
      setError((data as { error?: string } | null)?.error || '회사 정보를 불러오지 못했습니다.')
      setLoading(false)
      return
    }

    const companyData = (data as CompanyResponse).company
    setCompany(companyData)
    setMembers((data as CompanyResponse).members || [])
    setForm({
      name: companyData?.name || '',
      businessNumber: companyData?.business_number || '',
      logoUrl: companyData?.logo_url || '',
      businessLicenseUrl: companyData?.business_license_url || '',
    })
    setLoading(false)
  }

  useEffect(() => {
    if (!profile) return

    let cancelled = false

    async function initializeCompanyPage() {
      const { res, data } = await fetchCompanyData()
      if (cancelled) return

      if (!res.ok) {
        setError((data as { error?: string } | null)?.error || '회사 정보를 불러오지 못했습니다.')
        setLoading(false)
        return
      }

      const companyData = (data as CompanyResponse).company
      setCompany(companyData)
      setMembers((data as CompanyResponse).members || [])
      setForm({
        name: companyData?.name || '',
        businessNumber: companyData?.business_number || '',
        logoUrl: companyData?.logo_url || '',
        businessLicenseUrl: companyData?.business_license_url || '',
      })
      setLoading(false)
    }

    void initializeCompanyPage()

    return () => {
      cancelled = true
    }
  }, [profile])

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    const res = await fetch('/api/company', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json().catch(() => null)

    if (!res.ok) {
      setError(data?.error || '회사 생성에 실패했습니다.')
      setSaving(false)
      return
    }

    await refreshProfile()
    await loadCompany()
    setSuccess('회사 생성이 완료되었습니다.')
    setSaving(false)
  }

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    const res = await fetch('/api/company', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json().catch(() => null)

    if (!res.ok) {
      setError(data?.error || '회사 정보 저장에 실패했습니다.')
      setSaving(false)
      return
    }

    setCompany(data.company)
    await refreshProfile()
    setSuccess('회사 정보가 저장되었습니다.')
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">회사</h1>
        <p className="text-sm text-slate-500 mt-1">
          회사 정보와 팀 구성을 관리합니다.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      )}

      {success && (
        <p className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-300">
          {success}
        </p>
      )}

      {!company ? (
        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleCreateCompany}
          className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-6 shadow-sm space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">회사 생성</h2>
              <p className="text-sm text-slate-500">개인 계정을 회사 관리자 계정으로 전환합니다.</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-500 mb-2">회사명</label>
              <input
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
                required
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-2">사업자등록번호</label>
              <input
                value={form.businessNumber}
                onChange={(e) => updateForm('businessNumber', e.target.value)}
                required
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-2">로고 URL</label>
              <input
                value={form.logoUrl}
                onChange={(e) => updateForm('logoUrl', e.target.value)}
                placeholder="https://..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-2">사업자등록증 URL</label>
              <input
                value={form.businessLicenseUrl}
                onChange={(e) => updateForm('businessLicenseUrl', e.target.value)}
                placeholder="https://..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
            회사 만들기
          </button>
        </motion.form>
      ) : (
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-6 shadow-sm"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                    {company.name}
                  </h2>
                  {company.is_verified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
                      <BadgeCheck className="w-3.5 h-3.5" />
                      인증됨
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      인증 대기
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  사업자등록번호: {company.business_number}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  소속 멤버: {members.length}명
                </p>
              </div>

              {canEditCompany && (
                <Link
                  href="/admin/members"
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  <Users className="w-4 h-4" />
                  멤버 관리
                </Link>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900 dark:text-white">회사 정보</h3>
              {!canEditCompany && (
                <span className="text-xs text-slate-400">읽기 전용</span>
              )}
            </div>

            <form onSubmit={handleUpdateCompany} className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-500 mb-2">회사명</label>
                <input
                  value={form.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  disabled={!canEditCompany}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-2">사업자등록번호</label>
                <input
                  value={form.businessNumber}
                  onChange={(e) => updateForm('businessNumber', e.target.value)}
                  disabled={!canEditCompany}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-2">로고 URL</label>
                <input
                  value={form.logoUrl}
                  onChange={(e) => updateForm('logoUrl', e.target.value)}
                  disabled={!canEditCompany}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-2">사업자등록증 URL</label>
                <input
                  value={form.businessLicenseUrl}
                  onChange={(e) => updateForm('businessLicenseUrl', e.target.value)}
                  disabled={!canEditCompany}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
              </div>

              {canEditCompany && (
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    회사 정보 저장
                  </button>
                </div>
              )}
            </form>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-slate-900 dark:text-white">소속 멤버</h3>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-slate-700/60">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{member.full_name}</p>
                    <p className="text-sm text-slate-500">{member.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-slate-500">
                      {member.role === 'COMPANY_ADMIN'
                        ? '회사 관리자'
                        : member.role === 'SALES_MEMBER'
                          ? '영업사원'
                          : member.role}
                    </p>
                    <p className="text-xs text-slate-400">
                      {member.is_active === false ? '비활성' : '활성'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
