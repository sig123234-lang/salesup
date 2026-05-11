'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Navigation, Phone, List, Map as MapIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { Client, SalesStatus } from '@/types'
import { SALES_STATUS_CONFIG, cn } from '@/lib/utils'
import Link from 'next/link'

type KakaoLatLng = { readonly __brand: 'KakaoLatLng' }

type KakaoSize = { readonly __brand: 'KakaoSize' }

interface KakaoMapInstance {
  setCenter: (latlng: KakaoLatLng) => void
}

interface KakaoMarker {
  setMap: (map: KakaoMapInstance | null) => void
}

interface KakaoInfoWindow {
  open: (map: KakaoMapInstance, marker: KakaoMarker) => void
}

interface KakaoMapsApi {
  load: (callback: () => void) => void
  LatLng: new (lat: number, lng: number) => KakaoLatLng
  Map: new (container: HTMLDivElement, options: { center: KakaoLatLng; level: number }) => KakaoMapInstance
  Marker: new (options: {
    position: KakaoLatLng
    map?: KakaoMapInstance
    title?: string
    image?: unknown
  }) => KakaoMarker
  MarkerImage: new (src: string, size: KakaoSize) => unknown
  Size: new (width: number, height: number) => KakaoSize
  InfoWindow: new (options: { content: string; removable: boolean }) => KakaoInfoWindow
  event: {
    addListener: (marker: KakaoMarker, type: 'click', handler: () => void) => void
  }
}

interface KakaoGlobal {
  maps: KakaoMapsApi
}

declare global {
  interface Window {
    kakao?: KakaoGlobal
  }
}

export default function MapPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const mapRef = useRef<HTMLDivElement>(null)
  const kakaoMap = useRef<KakaoMapInstance | null>(null)
  const markers = useRef<KakaoMarker[]>([])

  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'map' | 'list'>('map')
  const [selectedStatus, setSelectedStatus] = useState<SalesStatus | 'ALL'>('ALL')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const hasKakao = typeof window !== 'undefined' && Boolean(window.kakao?.maps)
  const statusOptions: { value: SalesStatus | 'ALL'; label: string }[] = [
    { value: 'ALL', label: '전체' },
    ...Object.entries(SALES_STATUS_CONFIG).map(([value, config]) => ({
      value: value as SalesStatus,
      label: `${config.emoji} ${config.label}`,
    })),
  ]

  const updateMarkers = useCallback(() => {
    const mapInstance = kakaoMap.current
    if (!mapInstance || !window.kakao?.maps) return
    const kakao = window.kakao!
    markers.current.forEach((marker) => marker.setMap(null))
    markers.current = []

    const filtered = selectedStatus === 'ALL'
      ? clients
      : clients.filter((c) => c.sales_status === selectedStatus)

    filtered.forEach((client) => {
      if (!client.lat || !client.lng) return
      const pos = new kakao.maps.LatLng(client.lat, client.lng)
      const sc = SALES_STATUS_CONFIG[client.sales_status]

      const marker = new kakao.maps.Marker({
        position: pos,
        map: mapInstance,
        title: client.name,
      })

      const infoContent = `
        <div style="padding:8px 12px;background:white;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.15);min-width:140px;font-family:-apple-system,sans-serif">
          <div style="font-weight:600;font-size:13px;color:#1e293b;margin-bottom:4px">${client.name}</div>
          <div style="font-size:11px;color:#64748b">${sc.emoji} ${sc.label}</div>
          <div style="font-size:12px;color:#3b82f6;font-weight:600;margin-top:2px">${client.contract_probability}%</div>
        </div>
      `

      const infoWindow = new kakao.maps.InfoWindow({
        content: infoContent,
        removable: true,
      })

      kakao.maps.event.addListener(marker, 'click', () => {
        infoWindow.open(mapInstance, marker)
        setSelectedClient(client)
      })

      markers.current.push(marker)
    })
  }, [clients, selectedStatus])

  const initMap = useCallback(() => {
    const container = mapRef.current
    if (!container || !window.kakao?.maps) return
    const kakao = window.kakao!

    kakao.maps.load(() => {
      const defaultCenter = new kakao.maps.LatLng(37.5665, 126.9780)

      kakaoMap.current = new kakao.maps.Map(container, {
        center: defaultCenter,
        level: 5,
      })

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude: lat, longitude: lng } = pos.coords
            const latlng = new kakao.maps.LatLng(lat, lng)
            const mapInstance = kakaoMap.current
            if (!mapInstance) return

            mapInstance.setCenter(latlng)

            new kakao.maps.Marker({
              position: latlng,
              map: mapInstance,
              image: new kakao.maps.MarkerImage(
                'https://t1.kakaocdn.net/locallink/images/places/ico_search_clear.png',
                new kakao.maps.Size(10, 10)
              ),
            })
          },
          null,
          { enableHighAccuracy: true }
        )
      }

      updateMarkers()
    })
  }, [updateMarkers])

  useEffect(() => {
    if (!profile) return
    const currentProfile = profile

    let cancelled = false

    async function fetchClients() {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('owner_id', currentProfile.id)
        .not('lat', 'is', null)
        .not('lng', 'is', null)

      if (cancelled) return

      setClients((data || []) as Client[])
      setLoading(false)
    }

    void fetchClients()

    return () => {
      cancelled = true
    }
  }, [profile, supabase])

  useEffect(() => {
    if (!loading) {
      initMap()
    }
  }, [initMap, loading])

  useEffect(() => {
    if (kakaoMap.current) updateMarkers()
  }, [clients, selectedStatus, updateMarkers])

  const filteredClients = selectedStatus === 'ALL'
    ? clients
    : clients.filter((c) => c.sales_status === selectedStatus)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 md:px-8 pt-4 pb-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex-1">지도</h1>
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5">
          {(['map', 'list'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                view === v
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500'
              )}
            >
              {v === 'map' ? <MapIcon className="w-4 h-4" /> : <List className="w-4 h-4" />}
              {v === 'map' ? '지도' : '목록'}
            </button>
          ))}
        </div>
      </div>

      {/* Status Filter */}
      <div className="px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex gap-2 overflow-x-auto scrollbar-hide">
        {statusOptions.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setSelectedStatus(value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0',
              selectedStatus === value
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'map' ? (
        <div className="relative flex-1">
          {/* Map container */}
          <div ref={mapRef} className="w-full h-full min-h-[400px] bg-slate-200 dark:bg-slate-700">
            {!hasKakao && (
              <div className="flex items-center justify-center h-full text-slate-500 flex-col gap-3">
                <MapPin className="w-12 h-12 opacity-30" />
                <p className="text-sm">카카오맵 API 키가 필요합니다</p>
                <p className="text-xs text-slate-400">.env.local에 NEXT_PUBLIC_KAKAO_MAP_KEY 설정</p>
                {/* Fallback: show client list on map placeholder */}
                <div className="mt-4 space-y-2 w-full max-w-sm px-4">
                  {filteredClients.slice(0, 5).map((c) => (
                    <Link key={c.id} href={`/clients/${c.id}`}>
                      <div className="bg-white dark:bg-slate-800 rounded-xl p-3 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
                        <MapPin className="w-5 h-5 text-blue-500 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-sm text-slate-900 dark:text-white">{c.name}</p>
                          <p className="text-xs text-slate-400">{c.address || '주소 없음'}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Selected Client Card */}
          <AnimatePresence>
            {selectedClient && (
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="absolute bottom-4 left-4 right-4 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-4 border border-slate-100 dark:border-slate-700"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{selectedClient.name}</h3>
                    <p className="text-sm text-slate-500">{selectedClient.contact_name}</p>
                    {selectedClient.address && (
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{selectedClient.address}
                      </p>
                    )}
                  </div>
                  <button onClick={() => setSelectedClient(null)} className="text-slate-400 text-lg leading-none">×</button>
                </div>
                <div className="flex gap-2 mt-3">
                  {selectedClient.phone && (
                    <a href={`tel:${selectedClient.phone}`} className="flex-1 py-2 bg-green-50 text-green-600 rounded-xl text-sm font-medium flex items-center justify-center gap-1 hover:bg-green-100 transition-colors">
                      <Phone className="w-4 h-4" />전화
                    </a>
                  )}
                  <Link href={`/clients/${selectedClient.id}`} className="flex-1">
                    <button className="w-full py-2 bg-blue-600 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1 hover:bg-blue-500 transition-colors">
                      <Navigation className="w-4 h-4" />방문
                    </button>
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        // List view
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredClients.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
              거래처 주소를 등록해주세요
            </div>
          ) : (
            filteredClients.map((client) => {
              const sc = SALES_STATUS_CONFIG[client.sales_status]
              return (
                <Link key={client.id} href={`/clients/${client.id}`}>
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4 flex items-center gap-3 hover:shadow-md transition-all">
                    <div className={`w-10 h-10 rounded-xl ${sc.bg} flex items-center justify-center text-xl flex-shrink-0`}>
                      {sc.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">{client.name}</p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        <MapPin className="w-3 h-3 inline mr-1" />
                        {client.address || '주소 없음'}
                      </p>
                    </div>
                    {client.phone && (
                      <a
                        href={`tel:${client.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="w-9 h-9 bg-green-50 dark:bg-green-950 rounded-xl flex items-center justify-center flex-shrink-0"
                      >
                        <Phone className="w-4 h-4 text-green-600" />
                      </a>
                    )}
                  </div>
                </Link>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
