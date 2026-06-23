'use client'

import { useState } from 'react'
import { Bell, BellOff, Loader2, AlertTriangle } from 'lucide-react'

type Permission = 'default' | 'granted' | 'denied' | 'unsupported'

interface SettingsState {
  enabled: boolean
  /** 분 단위: 일정 N분 전 알림. 0 == 당일 morning_hour 시 */
  remind_minutes_before: number
  morning_hour: number // 0..23
}

const DEFAULT_STATE: SettingsState = {
  enabled: false,
  remind_minutes_before: 30,
  morning_hour: 9,
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const buf = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i)
  return buf
}

function readInitialPermission(): Permission {
  if (typeof window === 'undefined') return 'default'
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported'
  return Notification.permission as Permission
}

export function NotificationSettings({
  initialSettings,
}: {
  initialSettings: Partial<SettingsState> | null
}) {
  const [permission, setPermission] = useState<Permission>(readInitialPermission)
  const [state, setState] = useState<SettingsState>({
    ...DEFAULT_STATE,
    ...(initialSettings ?? {}),
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

  const enable = async () => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      if (!vapidPublic) throw new Error('VAPID 키가 설정되지 않았어요. 관리자 안내를 확인하세요.')
      if (permission === 'unsupported') throw new Error('이 브라우저는 알림을 지원하지 않아요.')
      const granted =
        permission === 'granted'
          ? 'granted'
          : ((await Notification.requestPermission()) as Permission)
      setPermission(granted)
      if (granted !== 'granted') throw new Error('알림 권한이 거부되었어요.')

      const reg = await navigator.serviceWorker.register('/sw-custom.js')
      await navigator.serviceWorker.ready

      let subscription = await reg.pushManager.getSubscription()
      if (!subscription) {
        const key = urlBase64ToUint8Array(vapidPublic)
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          // PushSubscriptionOptions wants a BufferSource; cast through ArrayBufferLike
          // because the lib.dom type narrows away SharedArrayBuffer slices.
          applicationServerKey: key.buffer as ArrayBuffer,
        })
      }

      const res = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          settings: { ...state, enabled: true },
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || '구독 저장 실패')
      }
      setState((s) => ({ ...s, enabled: true }))
      setMessage('알림이 활성화되었어요.')
    } catch (err) {
      setError(err instanceof Error ? err.message : '알림 활성화 실패')
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw-custom.js')
      const sub = await reg?.pushManager.getSubscription()
      await sub?.unsubscribe()
      await fetch('/api/notifications/subscribe', { method: 'DELETE' })
      setState((s) => ({ ...s, enabled: false }))
      setMessage('알림이 해제되었어요.')
    } catch (err) {
      setError(err instanceof Error ? err.message : '알림 해제 실패')
    } finally {
      setBusy(false)
    }
  }

  const saveSettings = async (next: SettingsState) => {
    setState(next)
    if (!next.enabled) return
    await fetch('/api/notifications/subscribe', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: next }),
    })
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-500" />
          <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
            팔로업 푸시 알림
          </h3>
        </div>
        {state.enabled ? (
          <button
            onClick={disable}
            disabled={busy}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <BellOff className="w-3 h-3" />}
            끄기
          </button>
        ) : (
          <button
            onClick={enable}
            disabled={busy || permission === 'unsupported'}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-amber-500 hover:bg-amber-400 text-white rounded-lg disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bell className="w-3 h-3" />}
            켜기
          </button>
        )}
      </div>

      <p className="text-xs text-slate-500">
        캘린더의 팔로업 / CS 리마인더 일정을 설정한 시간에 푸시로 알려드려요.
      </p>

      {permission === 'unsupported' && (
        <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-lg px-3 py-2">
          이 브라우저/장치는 푸시 알림을 지원하지 않아요. 모바일 PWA 설치 후 시도해주세요.
        </p>
      )}
      {permission === 'denied' && (
        <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-lg px-3 py-2">
          브라우저 알림 권한이 차단되어 있어요. 브라우저 설정에서 이 사이트의 알림을 허용해주세요.
        </p>
      )}
      {!vapidPublic && (
        <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 rounded-lg px-3 py-2 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            <code>NEXT_PUBLIC_VAPID_PUBLIC_KEY</code>가 설정되지 않아 알림을 활성화할 수 없어요.
            관리자에게 환경변수 설정을 요청하세요.
          </span>
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-slate-500 mb-1 block">일정 N분 전 알림</span>
          <select
            value={state.remind_minutes_before}
            onChange={(e) =>
              void saveSettings({
                ...state,
                remind_minutes_before: parseInt(e.target.value, 10),
              })
            }
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white"
          >
            <option value={0}>당일 아침</option>
            <option value={15}>15분 전</option>
            <option value={30}>30분 전</option>
            <option value={60}>1시간 전</option>
            <option value={120}>2시간 전</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-slate-500 mb-1 block">당일 알림 시간</span>
          <select
            value={state.morning_hour}
            onChange={(e) =>
              void saveSettings({ ...state, morning_hour: parseInt(e.target.value, 10) })
            }
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </label>
      </div>

      {message && (
        <p className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg px-3 py-2">
          {message}
        </p>
      )}
      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <details className="text-[11px] text-slate-500">
        <summary className="cursor-pointer">VAPID 키 설정 안내 (관리자)</summary>
        <pre className="mt-2 bg-slate-50 dark:bg-slate-900 rounded p-2 overflow-x-auto whitespace-pre-wrap">{`npx web-push generate-vapid-keys

# .env.local
VAPID_PRIVATE_KEY=...
VAPID_EMAIL=mailto:admin@yourcompany.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...   # client-exposed`}</pre>
      </details>
    </div>
  )
}
