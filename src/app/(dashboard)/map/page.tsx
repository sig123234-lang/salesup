'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Navigation, Phone, List, Map as MapIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { Client, SalesStatus } from '@/types'
import { SALES_STATUS_CONFIG, cn } from '@/lib/utils'
import Link from 'next/link'

// ────────────────────────────────────────────────────────────
// Google Maps type declarations
// ────────────────────────────────────────────────────────────
interface GoogleMapInstance {
  setCenter: (latlng: { lat: number; lng: number }) => void
  panTo: (latlng: { lat: number; lng: number }) => void
}

interface GoogleMarker {
  setMap: (map: GoogleMapInstance | null) => void
}

interface GoogleInfoWindow {
  open: (options: { anchor: GoogleMarker; map: GoogleMapInstance }) => void
  close: () => void
}

interface GoogleMapsNS {
  Map: new (
    container: HTMLDivElement,
    options: {
      center: { lat: number; lng: number }
      zoom: number
      mapTypeControl?: boolean
      streetViewControl?: boolean
      fullscreenControl?: boolean
    }
  ) => GoogleMapInstance
  Marker: new (options: {
    position: { lat: number; lng: number }
    map?: GoogleMapInstance
    title?: string
    icon?: {
      path: string
      fillColor: string
      fillOpacity: number
      strokeColor: string
      strokeWeight: number
      scale: number
      anchor: { x: number; y: number }
    }
  }) => GoogleMarker
  InfoWindow: new (options: { content: string; disableAutoPan?: boolean }) => GoogleInfoWindow
  event: {
    addListener: (obj: GoogleMarker, event: string, handler: () => void) => void
  }
}

declare global {
  interface Window {
    google?: { maps: GoogleMapsNS }
  }
}

// Status → colour mapping for markers
const STATUS_COLOURS: Record<string, string> = {
  NEW_LEAD: '#6366f1',
  FIRST_VISIT: '#3b82f6',
  QUOTE_SENT: '#f59e0b',
  FOLLOW_UP: '#ec4899',
  CONTRACT_IN_PROGRESS: '#8b5cf6',
  CONTRACTED: '#10b981',
  REJECTED: '#ef4444',
  POTENTIAL: '#64748b',
}

// SVG path for a teardrop / location pin shape
const PIN_SVG_PATH =
  'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z'

export default function MapPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const mapRef = useRef<HTMLDivElement>(null)
  const googleMap = useRef<GoogleMapInstance | null>(null)
  const markers = useRef<GoogleMarker[]>([])
  const openInfoWindow = useRef<GoogleInfoWindow | null>(null)

  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  // Lazy-initialise: if the Google Maps script is already loaded (e.g. page revisit), start ready.
  const [mapsReady, setMapsReady] = useState<boolean>(
    () => typeof window !== 'undefined' && Boolean(window.google?.maps)
  )
  const [view, setView] = useState<'map' | 'list'>('map')
  const [selectedStatus, setSelectedStatus] = useState<SalesStatus | 'ALL'>('ALL')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)

  const hasGoogleKey = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)

  const statusOptions: { value: SalesStatus | 'ALL'; label: string }[] = [
    { value: 'ALL', label: '전체' },
    ...Object.entries(SALES_STATUS_CONFIG).map(([value, config]) => ({
      value: value as SalesStatus,
      label: `${config.emoji} ${config.label}`,
    })),
  ]

  // Poll until Google Maps script has loaded (called from interval callback, not effect body)
  useEffect(() => {
    if (mapsReady) return
    let tries = 0
    const interval = setInterval(() => {
      tries++
      if (window.google?.maps) {
        setMapsReady(true)
        clearInterval(interval)
      } else if (tries > 40) {
        clearInterval(interval)
      }
    }, 250)
    return () => clearInterval(interval)
  }, [mapsReady])

  // Fetch clients with coordinates
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

  // Rebuild markers whenever clients or filter changes
  const updateMarkers = useCallback(() => {
    const mapInstance = googleMap.current
    if (!mapInstance || !window.google?.maps) return

    markers.current.forEach((m) => m.setMap(null))
    markers.current = []
    if (openInfoWindow.current) {
      openInfoWindow.current.close()
      openInfoWindow.current = null
    }

    const filtered =
      selectedStatus === 'ALL'
        ? clients
        : clients.filter((c) => c.sales_status === selectedStatus)

    filtered.forEach((client) => {
      if (!client.lat || !client.lng) return

      const position = { lat: client.lat, lng: client.lng }
      const sc = SALES_STATUS_CONFIG[client.sales_status]
      const color = STATUS_COLOURS[client.sales_status] ?? '#3b82f6'

      const marker = new window.google!.maps.Marker({
        position,
        map: mapInstance,
        title: client.name,
        icon: {
          path: PIN_SVG_PATH,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 1.5,
          scale: 1.4,
          anchor: { x: 12, y: 22 },
        },
      })

      const infoContent = `
        <div style="padding:10px 14px;min-width:160px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
          <div style="font-weight:700;font-size:14px;color:#1e293b;margin-bottom:4px">${client.name}</div>
          <div style="font-size:12px;color:#64748b;margin-bottom:2px">${sc.emoji} ${sc.label}</div>
          <div style="font-size:13px;color:#3b82f6;font-weight:600">${client.contract_probability}%</div>
          ${client.address ? `<div style="font-size:11px;color:#94a3b8;margin-top:4px">📍 ${client.address}</div>` : ''}
        </div>
      `

      const infoWindow = new window.google!.maps.InfoWindow({ content: infoContent })

      window.google!.maps.event.addListener(marker, 'click', () => {
        if (openInfoWindow.current) openInfoWindow.current.close()
        infoWindow.open({ anchor: marker, map: mapInstance })
        openInfoWindow.current = infoWindow
        setSelectedClient(client)
      })

      markers.current.push(marker)
    })
  }, [clients, selectedStatus])

  // Initialise map once (on first ready)
  const initMap = useCallback(() => {
    const container = mapRef.current
    if (!container || !window.google?.maps || googleMap.current) return

    googleMap.current = new window.google.maps.Map(container, {
      center: { lat: 37.5665, lng: 126.978 },
      zoom: 12,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    })

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords
          const mapInstance = googleMap.current
          if (!mapInstance || !window.google?.maps) return

          mapInstance.setCenter({ lat, lng })

          new window.google!.maps.Marker({
            position: { lat, lng },
            map: mapInstance,
            title: '현재 위치',
            icon: {
              path: 'M12 7a5 5 0 1 0 0 10A5 5 0 0 0 12 7z',
              fillColor: '#3b82f6',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: 1.5,
              anchor: { x: 12, y: 12 },
            },
          })
        },
        null,
        { enableHighAccuracy: true, timeout: 8000 }
      )
    }

    updateMarkers()
  }, [updateMarkers])

  useEffect(() => {
    if (!loading && mapsReady) initMap()
  }, [initMap, loading, mapsReady])

  useEffect(() => {
    if (googleMap.current) updateMarkers()
  }, [clients, selectedStatus, updateMarkers])

  const filteredClients =
    selectedStatus === 'ALL'
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
          {/* Map container — always mounted so the ref attaches */}
          <div ref={mapRef} className="w-full h-full min-h-[400px] bg-slate-200 dark:bg-slate-700" />

          {/* Overlay when maps not ready */}
          {!mapsReady && (
            <div className="absolute inset-0 flex items-center justify-center flex-col gap-3 bg-slate-100 dark:bg-slate-800">
              {!hasGoogleKey ? (
                <>
                  <MapPin className="w-12 h-12 opacity-30 text-slate-400" />
                  <p className="text-sm text-slate-500">Google Maps API 키가 필요합니다</p>
                  <p className="text-xs text-slate-400">
                    .env.local에 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY 설정
                  </p>
                  <div className="mt-4 space-y-2 w-full max-w-sm px-4">
                    {filteredClients.slice(0, 5).map((c) => (
                      <Link key={c.id} href={`/clients/${c.id}`}>
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-3 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
                          <MapPin className="w-5 h-5 text-blue-500 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm text-slate-900 dark:text-white">
                              {c.name}
                            </p>
                            <p className="text-xs text-slate-400">{c.address || '주소 없음'}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-slate-500">지도를 불러오는 중…</p>
                </>
              )}
            </div>
          )}

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
                    <h3 className="font-bold text-slate-900 dark:text-white">
                      {selectedClient.name}
                    </h3>
                    <p className="text-sm text-slate-500">{selectedClient.contact_name}</p>
                    {selectedClient.address && (
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {selectedClient.address}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedClient(null)}
                    className="text-slate-400 text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
                <div className="flex gap-2 mt-3">
                  {selectedClient.phone && (
                    <a
                      href={`tel:${selectedClient.phone}`}
                      className="flex-1 py-2 bg-green-50 text-green-600 rounded-xl text-sm font-medium flex items-center justify-center gap-1 hover:bg-green-100 transition-colors"
                    >
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
        /* List view */
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
                    <div
                      className={`w-10 h-10 rounded-xl ${sc.bg} flex items-center justify-center text-xl flex-shrink-0`}
                    >
                      {sc.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">
                        {client.name}
                      </p>
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
