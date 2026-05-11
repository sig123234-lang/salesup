'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, FileText, UserPlus, Calendar, X, Zap } from 'lucide-react'
import { useQuickCaptureStore } from '@/store'

const actions = [
  { mode: 'VOICE' as const, icon: Mic, label: '음성 메모', color: 'bg-red-500' },
  { mode: 'NOTE' as const, icon: FileText, label: '빠른 메모', color: 'bg-amber-500' },
  { mode: 'CLIENT' as const, icon: UserPlus, label: '고객 추가', color: 'bg-green-500' },
  { mode: 'EVENT' as const, icon: Calendar, label: '일정 추가', color: 'bg-purple-500' },
]

export default function FloatingAIButton() {
  const { open } = useQuickCaptureStore()
  const [expanded, setExpanded] = useState(false)
  const [shakeDetected, setShakeDetected] = useState(false)

  // Shake Gesture Detection (PWA)
  useEffect(() => {
    let lastX = 0, lastY = 0, lastZ = 0
    let lastTime = 0
    const SHAKE_THRESHOLD = 15

    const handleMotion = (e: DeviceMotionEvent) => {
      const accel = e.accelerationIncludingGravity
      if (!accel) return

      const now = Date.now()
      const timeDiff = now - lastTime
      if (timeDiff < 100) return

      const { x = 0, y = 0, z = 0 } = accel
      const deltaX = Math.abs((x ?? 0) - lastX)
      const deltaY = Math.abs((y ?? 0) - lastY)
      const deltaZ = Math.abs((z ?? 0) - lastZ)

      if (deltaX + deltaY + deltaZ > SHAKE_THRESHOLD) {
        setShakeDetected(true)
        setExpanded(true)
        setTimeout(() => setShakeDetected(false), 1000)
      }

      lastX = x ?? 0
      lastY = y ?? 0
      lastZ = z ?? 0
      lastTime = now
    }

    if (typeof DeviceMotionEvent !== 'undefined') {
      window.addEventListener('devicemotion', handleMotion)
    }

    return () => {
      if (typeof DeviceMotionEvent !== 'undefined') {
        window.removeEventListener('devicemotion', handleMotion)
      }
    }
  }, [])

  return (
    <div className="fixed bottom-24 right-4 md:bottom-8 md:right-6 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {expanded && (
          <>
            {actions.map(({ mode, icon: Icon, label, color }, i) => (
              <motion.button
                key={mode}
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => {
                  setExpanded(false)
                  open(mode)
                }}
                className="flex items-center gap-2 pr-4 pl-3 py-2.5 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-100 dark:border-slate-700 hover:shadow-xl transition-all"
              >
                <div className={`w-7 h-7 ${color} rounded-full flex items-center justify-center`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">{label}</span>
              </motion.button>
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Main FAB */}
      <motion.button
        onClick={() => setExpanded(!expanded)}
        whileTap={{ scale: 0.9 }}
        animate={shakeDetected ? { scale: [1, 1.3, 1] } : {}}
        className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all ${
          expanded
            ? 'bg-slate-700 dark:bg-slate-600'
            : 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/30'
        }`}
      >
        <AnimatePresence mode="wait">
          {expanded ? (
            <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X className="w-6 h-6 text-white" />
            </motion.div>
          ) : (
            <motion.div key="zap" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <Zap className="w-6 h-6 text-white" strokeWidth={2.5} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  )
}
