'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Zap, ArrowRight, Loader2 } from 'lucide-react'

const LOGIN_BACKGROUND_DOTS = Array.from({ length: 20 }, (_, index) => ({
  id: index,
  left: (index * 19) % 100,
  top: (index * 31) % 100,
  duration: 3 + (index % 4) * 0.6,
  delay: (index % 5) * 0.35,
}))

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // 테스트 계정: pure-on / pureon123 → 이메일로 변환
    let loginEmail = email
    if (email === 'pure-on') loginEmail = 'pureon@salesup.app'

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    })

    if (authError) {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      {/* Background dots */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {LOGIN_BACKGROUND_DOTS.map((dot) => (
          <motion.div
            key={dot.id}
            className="absolute w-1 h-1 bg-blue-400/20 rounded-full"
            style={{
              left: `${dot.left}%`,
              top: `${dot.top}%`,
            }}
            animate={{ opacity: [0.2, 0.8, 0.2], scale: [1, 1.5, 1] }}
            transition={{ duration: dot.duration, repeat: Infinity, delay: dot.delay }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="inline-flex items-center gap-2 mb-4"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Zap className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">SalesUp</span>
          </motion.div>
          <p className="text-slate-400 text-sm">영업을 기억하는 AI 파트너</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-xl font-semibold text-white mb-6">로그인</h1>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-2">아이디 / 이메일</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pure-on 또는 이메일"
                required
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-2">비밀번호</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호 입력"
                  required
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  로그인
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Test account hint */}
          <div className="mt-6 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <p className="text-xs text-blue-300 font-medium mb-1">🧪 테스트 계정</p>
            <p className="text-xs text-slate-400">
              아이디: <span className="text-blue-300 font-mono">pure-on</span>
              &nbsp;&nbsp;비밀번호: <span className="text-blue-300 font-mono">pureon123</span>
            </p>
          </div>

          <div className="mt-6 text-center">
            <p className="text-slate-500 text-sm">
              계정이 없으신가요?{' '}
              <Link href="/register" className="text-blue-400 hover:text-blue-300 font-medium">
                회원가입
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
