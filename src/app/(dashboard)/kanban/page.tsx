'use client'

import { useEffect, useState } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Plus, Phone, MapPin, Settings2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { useKanbanConfig } from '@/lib/hooks/useKanbanConfig'
import { Client, SalesStatus } from '@/types'
import { SALES_STATUS_CONFIG, getProbabilityColor, formatRelativeTime } from '@/lib/utils'
import { KanbanConfigModal } from '@/components/kanban/KanbanConfigModal'
import Link from 'next/link'

type Board = Record<SalesStatus, Client[]>

const ALL_STATUSES: SalesStatus[] = [
  'NEW_LEAD', 'FIRST_VISIT', 'QUOTE_SENT', 'FOLLOW_UP',
  'CONTRACT_IN_PROGRESS', 'CONTRACTED', 'POTENTIAL', 'REJECTED',
]

function createEmptyBoard(): Board {
  return ALL_STATUSES.reduce((acc, s) => ({ ...acc, [s]: [] }), {} as Board)
}

export default function KanbanPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const { columns, enabledColumns, toggleColumn, reorderColumns } = useKanbanConfig()

  const [board, setBoard] = useState<Board>(createEmptyBoard)
  const [loading, setLoading] = useState(true)
  const [configOpen, setConfigOpen] = useState(false)

  useEffect(() => {
    if (!profile) return
    const currentProfile = profile
    let cancelled = false

    async function fetchClients() {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .or(
          currentProfile.company_id
            ? `owner_id.eq.${currentProfile.id},company_id.eq.${currentProfile.company_id}`
            : `owner_id.eq.${currentProfile.id}`
        )
        .order('updated_at', { ascending: false })

      if (cancelled) return

      const newBoard = createEmptyBoard()
      ;(data ?? []).forEach((client) => {
        const c = client as Client
        if (newBoard[c.sales_status]) newBoard[c.sales_status].push(c)
      })
      setBoard(newBoard)
      setLoading(false)
    }

    void fetchClients()
    return () => { cancelled = true }
  }, [profile, supabase])

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    const srcStatus = source.droppableId as SalesStatus
    const destStatus = destination.droppableId as SalesStatus

    const newBoard = { ...board }
    const [moved] = newBoard[srcStatus].splice(source.index, 1)
    moved.sales_status = destStatus
    newBoard[destStatus].splice(destination.index, 0, moved)
    setBoard(newBoard)

    await supabase.from('clients').update({ sales_status: destStatus }).eq('id', draggableId)

    const user = (await supabase.auth.getUser()).data.user
    if (user) {
      const srcCfg = SALES_STATUS_CONFIG[srcStatus]
      const destCfg = SALES_STATUS_CONFIG[destStatus]
      await supabase.from('activities').insert({
        client_id: draggableId,
        user_id: user.id,
        type: 'STATUS_CHANGE',
        content: `영업 상태가 '${srcCfg.label}'에서 '${destCfg.label}'(으)로 변경되었습니다.`,
        metadata: { from: srcStatus, to: destStatus },
      })
    }
  }

  const totalClients = ALL_STATUSES.reduce((sum, s) => sum + board[s].length, 0)

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="px-4 md:px-6 pt-5 pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">영업 현황</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              총 {totalClients}개 거래처 · {enabledColumns.length}개 단계 표시 중
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfigOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              <Settings2 className="w-4 h-4" />
              <span className="hidden sm:inline">컬럼 설정</span>
            </button>
            <Link href="/clients/new">
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-500 transition-colors">
                <Plus className="w-4 h-4" />
                추가
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Board */}
      {loading ? (
        <div className="flex-1 overflow-x-auto p-4 md:p-6">
          <div className="flex gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-72 flex-shrink-0">
                <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl mb-3 animate-pulse" />
                <div className="space-y-2">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="h-24 bg-white dark:bg-slate-800 rounded-xl animate-pulse border border-slate-100 dark:border-slate-700" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : enabledColumns.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-400">
          <div className="text-center">
            <Settings2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">표시할 컬럼이 없어요</p>
            <button
              onClick={() => setConfigOpen(true)}
              className="mt-3 text-sm text-blue-600 hover:text-blue-500"
            >
              컬럼 추가하기
            </button>
          </div>
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-3 p-4 md:p-6 h-full" style={{ minWidth: `${enabledColumns.length * 288 + (enabledColumns.length - 1) * 12 + 48}px` }}>
              {enabledColumns.map(({ id: status }) => {
                const cfg = SALES_STATUS_CONFIG[status]
                const cards = board[status]
                const count = cards.length

                return (
                  <div key={status} className="w-72 flex-shrink-0 flex flex-col">
                    {/* Column Header */}
                    <div className={`mb-3 px-3 py-2.5 rounded-xl ${cfg.bg} dark:bg-opacity-20 flex items-center justify-between`}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{cfg.emoji}</span>
                        <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white/80 dark:bg-black/20 ${cfg.color}`}>
                        {count}
                      </span>
                    </div>

                    {/* Cards Area */}
                    <Droppable droppableId={status}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 min-h-[120px] rounded-2xl p-2 transition-all ${
                            snapshot.isDraggingOver
                              ? 'bg-blue-50 dark:bg-blue-950/40 border-2 border-dashed border-blue-300 dark:border-blue-700'
                              : count === 0
                              ? 'bg-slate-100/50 dark:bg-slate-800/20 border-2 border-dashed border-slate-200 dark:border-slate-700/50'
                              : 'bg-slate-100/50 dark:bg-slate-800/20'
                          }`}
                        >
                          <div className="space-y-2">
                            {cards.map((client, index) => (
                              <Draggable key={client.id} draggableId={client.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-100 dark:border-slate-700 transition-shadow ${
                                      snapshot.isDragging
                                        ? 'shadow-xl rotate-1 border-blue-200 dark:border-blue-700'
                                        : 'shadow-sm hover:shadow-md'
                                    }`}
                                  >
                                    <Link href={`/clients/${client.id}`}>
                                      <div className="flex items-start justify-between gap-2 mb-2">
                                        <h3 className="font-semibold text-slate-900 dark:text-white text-sm leading-tight">
                                          {client.name}
                                        </h3>
                                        <span className={`text-xs font-bold flex-shrink-0 ${getProbabilityColor(client.contract_probability)}`}>
                                          {client.contract_probability}%
                                        </span>
                                      </div>

                                      {client.contact_name && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                                          {client.contact_name}
                                        </p>
                                      )}

                                      {client.phone && (
                                        <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                                          <Phone className="w-3 h-3" />
                                          {client.phone}
                                        </div>
                                      )}

                                      {client.address && (
                                        <div className="flex items-center gap-1 text-xs text-slate-400 truncate">
                                          <MapPin className="w-3 h-3 flex-shrink-0" />
                                          <span className="truncate">{client.address}</span>
                                        </div>
                                      )}

                                      <div className="mt-2.5 h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all ${
                                            client.contract_probability >= 70 ? 'bg-green-500' :
                                            client.contract_probability >= 40 ? 'bg-yellow-500' : 'bg-red-400'
                                          }`}
                                          style={{ width: `${client.contract_probability}%` }}
                                        />
                                      </div>

                                      <div className="mt-1.5 text-xs text-slate-400">
                                        {formatRelativeTime(client.last_contacted_at)}
                                      </div>
                                    </Link>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                          </div>

                          {provided.placeholder}

                          {count === 0 && !snapshot.isDraggingOver && (
                            <div className="flex items-center justify-center h-16 text-xs text-slate-300 dark:text-slate-600">
                              여기로 드래그
                            </div>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>
                )
              })}
            </div>
          </div>
        </DragDropContext>
      )}

      {/* Config Modal */}
      {configOpen && (
        <KanbanConfigModal
          columns={columns}
          onToggle={toggleColumn}
          onReorder={reorderColumns}
          onClose={() => setConfigOpen(false)}
        />
      )}
    </div>
  )
}
