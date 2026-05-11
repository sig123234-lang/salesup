'use client'

import { useEffect, useState } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Plus, Phone, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { Client, SalesStatus } from '@/types'
import { SALES_STATUS_CONFIG, getProbabilityColor, formatRelativeTime } from '@/lib/utils'
import Link from 'next/link'

const COLUMNS: SalesStatus[] = [
  'NEW_LEAD', 'FIRST_VISIT', 'QUOTE_SENT', 'FOLLOW_UP',
  'CONTRACT_IN_PROGRESS', 'CONTRACTED', 'POTENTIAL', 'REJECTED'
]

type Board = Record<SalesStatus, Client[]>

function createEmptyBoard(): Board {
  const empty = {} as Board
  COLUMNS.forEach((status) => {
    empty[status] = []
  })
  return empty
}

export default function KanbanPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const [board, setBoard] = useState<Board>(() => createEmptyBoard())
  const [loading, setLoading] = useState(true)

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
      ;(data || []).forEach((client) => {
        const typedClient = client as Client
        if (newBoard[typedClient.sales_status]) {
          newBoard[typedClient.sales_status].push(typedClient)
        }
      })
      setBoard(newBoard)
      setLoading(false)
    }

    void fetchClients()

    return () => {
      cancelled = true
    }
  }, [profile, supabase])

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    const srcStatus = source.droppableId as SalesStatus
    const destStatus = destination.droppableId as SalesStatus

    // Optimistic update
    const newBoard = { ...board }
    const [moved] = newBoard[srcStatus].splice(source.index, 1)
    moved.sales_status = destStatus
    newBoard[destStatus].splice(destination.index, 0, moved)
    setBoard(newBoard)

    // DB update
    await supabase
      .from('clients')
      .update({ sales_status: destStatus })
      .eq('id', draggableId)

    // Activity log
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

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.slice(0, 5).map((s) => (
            <div key={s} className="min-w-[280px] h-96 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 md:px-8 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">영업 현황</h1>
            <p className="text-sm text-slate-500">드래그하여 상태 변경</p>
          </div>
          <Link href="/clients/new">
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-500 transition-colors">
              <Plus className="w-4 h-4" />
              추가
            </button>
          </Link>
        </div>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-4 p-4 md:p-6 min-w-max">
            {COLUMNS.map((status) => {
              const cfg = SALES_STATUS_CONFIG[status]
              const count = board[status].length
              return (
                <div key={status} className="w-72 flex-shrink-0 flex flex-col">
                  {/* Column Header */}
                  <div className={`mb-3 px-3 py-2.5 rounded-xl ${cfg.bg} flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">{cfg.emoji}</span>
                      <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white/60 ${cfg.color}`}>{count}</span>
                  </div>

                  {/* Cards */}
                  <Droppable droppableId={status}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 min-h-[400px] rounded-2xl p-2 transition-colors ${
                          snapshot.isDraggingOver
                            ? 'bg-blue-50 dark:bg-blue-950/30 border-2 border-dashed border-blue-300'
                            : 'bg-slate-100/60 dark:bg-slate-800/30'
                        }`}
                      >
                        <div className="space-y-2">
                          {board[status].map((client, index) => (
                            <Draggable key={client.id} draggableId={client.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-100 dark:border-slate-700 shadow-sm transition-shadow ${
                                    snapshot.isDragging ? 'shadow-xl rotate-1' : 'hover:shadow-md'
                                  }`}
                                >
                                  <Link href={`/clients/${client.id}`}>
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <h3 className="font-semibold text-slate-900 dark:text-white text-sm leading-tight">{client.name}</h3>
                                      <span className={`text-sm font-bold flex-shrink-0 ${getProbabilityColor(client.contract_probability)}`}>
                                        {client.contract_probability}%
                                      </span>
                                    </div>

                                    {client.contact_name && (
                                      <p className="text-xs text-slate-500 mb-1.5">{client.contact_name}</p>
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

                                    {/* Progress bar */}
                                    <div className="mt-2 h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
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
                          <div className="flex items-center justify-center h-20 text-xs text-slate-400">
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
    </div>
  )
}
