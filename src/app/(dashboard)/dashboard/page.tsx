'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Settings2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { useDashboardConfig } from '@/lib/hooks/useDashboardConfig'
import { Client, CalendarEvent, WidgetId } from '@/types'

import { StatsWidget } from '@/components/widgets/StatsWidget'
import { RecentClientsWidget } from '@/components/widgets/RecentClientsWidget'
import { CalendarWidget } from '@/components/widgets/CalendarWidget'
import { AITipWidget } from '@/components/widgets/AITipWidget'
import { KanbanPreviewWidget } from '@/components/widgets/KanbanPreviewWidget'
import { FollowupAlertWidget } from '@/components/widgets/FollowupAlertWidget'
import { CSReminderWidget } from '@/components/widgets/CSReminderWidget'
import { FollowupCounterWidget } from '@/components/widgets/FollowupCounterWidget'
import { DailyBriefWidget } from '@/components/widgets/DailyBriefWidget'
import { GoalTrackerWidget } from '@/components/widgets/GoalTrackerWidget'
import { CompetitorWidget } from '@/components/widgets/CompetitorWidget'
import { DailyReportWidget } from '@/components/widgets/DailyReportWidget'
import { DashboardEditModal } from '@/components/widgets/DashboardEditModal'

interface DashboardData {
  clients: Client[]
  events: CalendarEvent[]
}

function getHourGreeting() {
  const h = new Date().getHours()
  if (h < 12) return '좋은 아침이에요'
  if (h < 18) return '좋은 오후에요'
  return '수고하셨어요'
}

function computeStats(clients: Client[]) {
  const contracted = clients.filter((c) => c.sales_status === 'CONTRACTED').length
  const inProgress = clients.filter((c) => c.sales_status === 'CONTRACT_IN_PROGRESS').length
  const pendingFollowups = clients.filter(
    (c) => c.next_contact_at && new Date(c.next_contact_at) <= new Date()
  ).length
  const conversionRate = clients.length > 0 ? Math.round((contracted / clients.length) * 100) : 0
  return { contracted, inProgress, pendingFollowups, conversionRate }
}

// Widget layout: some widgets span full width, some are half
const WIDGET_SPAN: Partial<Record<WidgetId, 'full' | 'half'>> = {
  'daily-brief': 'full',
  stats: 'full',
  'recent-clients': 'full',
  calendar: 'half',
  'ai-tip': 'half',
  'kanban-preview': 'half',
  'followup-alert': 'half',
  'cs-reminder': 'full',
  'followup-counter': 'full',
  'goal-tracker': 'full',
  'competitor-intel': 'full',
  'daily-report': 'full',
}

export default function DashboardPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const { widgets, enabledWidgets, toggleWidget, reorderWidgets } = useDashboardConfig()

  const [data, setData] = useState<DashboardData>({ clients: [], events: [] })
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    if (!profile) return
    const userId = profile.id
    let cancelled = false

    async function fetchData() {
      const currentProfile = profile!
      let clientsQuery = supabase
        .from('clients')
        .select('*')
        .order('updated_at', { ascending: false })

      if (currentProfile.company_id) {
        clientsQuery = clientsQuery.or(
          `owner_id.eq.${userId},company_id.eq.${currentProfile.company_id}`
        )
      } else {
        clientsQuery = clientsQuery.eq('owner_id', userId)
      }

      const [clientsRes, eventsRes] = await Promise.all([
        clientsQuery,
        supabase
          .from('calendar_events')
          .select('*, client:clients(name)')
          .eq('user_id', userId)
          .gte('start_at', new Date().toISOString())
          .order('start_at')
          .limit(5),
      ])

      if (cancelled) return
      setData({
        clients: (clientsRes.data ?? []) as Client[],
        events: (eventsRes.data ?? []) as CalendarEvent[],
      })
      setLoading(false)
    }

    void fetchData()
    return () => { cancelled = true }
  }, [profile, supabase])

  const stats = computeStats(data.clients)
  const recentClients = data.clients.slice(0, 6)

  function renderWidget(id: WidgetId) {
    switch (id) {
      case 'daily-brief':
        return <DailyBriefWidget />
      case 'stats':
        return (
          <StatsWidget
            totalClients={data.clients.length}
            contracted={stats.contracted}
            inProgress={stats.inProgress}
            pendingFollowups={stats.pendingFollowups}
            conversionRate={stats.conversionRate}
          />
        )
      case 'recent-clients':
        return <RecentClientsWidget clients={recentClients} loading={loading} />
      case 'calendar':
        return <CalendarWidget events={data.events} loading={loading} />
      case 'ai-tip':
        return <AITipWidget pendingFollowups={stats.pendingFollowups} />
      case 'kanban-preview':
        return <KanbanPreviewWidget clients={data.clients} loading={loading} />
      case 'followup-alert':
        return <FollowupAlertWidget clients={data.clients} loading={loading} />
      case 'cs-reminder':
        return <CSReminderWidget />
      case 'followup-counter':
        return <FollowupCounterWidget clients={data.clients} loading={loading} />
      case 'goal-tracker':
        return <GoalTrackerWidget />
      case 'competitor-intel':
        return <CompetitorWidget />
      case 'daily-report':
        return <DailyReportWidget />
    }
  }

  // Group half-width widgets into pairs for the grid
  type Row = { type: 'full'; id: WidgetId } | { type: 'pair'; ids: WidgetId[] }

  const rows: Row[] = []
  let halfBuffer: WidgetId[] = []

  for (const w of enabledWidgets) {
    const span = WIDGET_SPAN[w.id] ?? 'full'
    if (span === 'full') {
      if (halfBuffer.length > 0) {
        rows.push({ type: 'pair', ids: [...halfBuffer] })
        halfBuffer = []
      }
      rows.push({ type: 'full', id: w.id })
    } else {
      halfBuffer.push(w.id)
      if (halfBuffer.length === 2) {
        rows.push({ type: 'pair', ids: [...halfBuffer] })
        halfBuffer = []
      }
    }
  }
  if (halfBuffer.length > 0) {
    rows.push({ type: 'pair', ids: [...halfBuffer] })
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between mb-8"
      >
        <div>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">{getHourGreeting()} 👋</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {profile?.full_name || '영업사원'}님의 오늘
          </h1>
        </div>
        <button
          onClick={() => setEditOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
        >
          <Settings2 className="w-4 h-4" />
          <span className="hidden sm:inline">편집</span>
        </button>
      </motion.div>

      {/* Widget Rows */}
      <div className="space-y-4 md:space-y-6">
        {rows.map((row, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            {row.type === 'full' ? (
              renderWidget(row.id)
            ) : (
              <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
                {row.ids.map((id) => (
                  <div key={id}>{renderWidget(id)}</div>
                ))}
              </div>
            )}
          </motion.div>
        ))}

        {enabledWidgets.length === 0 && (
          <div className="py-20 text-center text-slate-400">
            <Settings2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">표시할 위젯이 없어요</p>
            <button
              onClick={() => setEditOpen(true)}
              className="mt-3 text-sm text-blue-600 hover:text-blue-500"
            >
              위젯 추가하기
            </button>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editOpen && (
        <DashboardEditModal
          widgets={widgets}
          onToggle={toggleWidget}
          onReorder={reorderWidgets}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  )
}
