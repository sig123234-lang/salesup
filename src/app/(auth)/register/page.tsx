'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Zap, ArrowRight, ArrowLeft, User, Building2, Upload, Loader2, Check } from 'lucide-react'

type AccountType = 'personal' | 'company'

export default function RegisterPage() {
  const [step, setStep] = useState<1 | 2>(1)
  const [accountType, setAccountType] = useState<AccountType>('personal')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Form fields
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    businessNumber: '',
  })

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    if (form.password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { data, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName,
          role: accountType === 'company' ? 'COMPANY_ADMIN' : 'PERSONAL_USER',
        },
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // 회사 계정이면 회사 생성
    if (accountType === 'company' && data.user) {
      await supabase.from('companies').insert({
        name: form.companyName,
        business_number: form.businessNumber,
        admin_id: data.user.id,
        is_verified: false,
      })
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">가입 완료!</h2>
          <p className="text-slate-400 mb-6">이메일을 확인하여 인증을 완료해주세요.</p>
          <Link
            href="/login"
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-500 transition-colors"
          >
            로그인하기
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-xl font-bold text-white">SalesUp</span>
          </div>
          <p className="text-slate-400 text-sm">새 계정 만들기</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <h2 className="text-lg font-semibold text-white mb-6">계정 유형 선택</h2>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {[
                    { type: 'personal' as AccountType, icon: User, title: '개인 사용자', desc: '프리랜서, 개인 영업' },
                    { type: 'company' as AccountType, icon: Building2, title: '회사 관리자', desc: '팀 관리, 영업 조직' },
                  ].map(({ type, icon: Icon, title, desc }) => (
                    <button
                      key={type}
                      onClick={() => setAccountType(type)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        accountType === type
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <Icon className={`w-6 h-6 mb-2 ${accountType === type ? 'text-blue-400' : 'text-slate-400'}`} />
                      <div className={`text-sm font-medium ${accountType === type ? 'text-white' : 'text-slate-300'}`}>
                        {title}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-300 mb-2">이름</label>
                    <input
                      type="text"
                      value={form.fullName}
                      onChange={(e) => update('fullName', e.target.value)}
                      placeholder="홍길동"
                      required
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-2">이메일</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => update('email', e.target.value)}
                      placeholder="email@example.com"
                      required
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>

                <button
                  onClick={() => setStep(2)}
                  disabled={!form.fullName || !form.email}
                  className="w-full mt-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
                >
                  다음 <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            ) : (
              <motion.form
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 mb-4">
                  <button type="button" onClick={() => setStep(1)} className="text-slate-400 hover:text-white">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-lg font-semibold text-white">계정 설정</h2>
                </div>

                {accountType === 'company' && (
                  <>
                    <div>
                      <label className="block text-sm text-slate-300 mb-2">회사명</label>
                      <input
                        type="text"
                        value={form.companyName}
                        onChange={(e) => update('companyName', e.target.value)}
                        placeholder="(주)SalesUp"
                        required
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300 mb-2">사업자등록번호</label>
                      <input
                        type="text"
                        value={form.businessNumber}
                        onChange={(e) => update('businessNumber', e.target.value)}
                        placeholder="000-00-00000"
                        required
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300 mb-2">
                        사업자등록증 <span className="text-slate-500 text-xs">(선택)</span>
                      </label>
                      <label className="w-full px-4 py-3 bg-white/10 border border-dashed border-white/20 rounded-xl text-slate-400 flex items-center gap-2 cursor-pointer hover:border-white/30 text-sm">
                        <Upload className="w-4 h-4" />
                        파일 업로드
                        <input type="file" accept="image/*,.pdf" className="hidden" />
                      </label>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm text-slate-300 mb-2">비밀번호</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => update('password', e.target.value)}
                    placeholder="6자 이상"
                    required
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-2">비밀번호 확인</label>
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => update('confirmPassword', e.target.value)}
                    placeholder="비밀번호 재입력"
                    required
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                {error && (
                  <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '가입 완료'}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <p className="text-center text-slate-500 text-sm mt-4">
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className="text-blue-400 hover:text-blue-300">
              로그인
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
