import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Profile, QuickCaptureMode, Client } from '@/types'

// ============================================================
// Auth Store
// ============================================================
interface AuthStore {
  profile: Profile | null
  setProfile: (profile: Profile | null) => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      profile: null,
      setProfile: (profile) => set({ profile }),
    }),
    { name: 'salesup-auth' }
  )
)

// ============================================================
// Quick Capture Store
// ============================================================
interface QuickCaptureStore extends QuickCaptureMode {
  open: (mode: QuickCaptureMode['mode']) => void
  close: () => void
}

export const useQuickCaptureStore = create<QuickCaptureStore>((set) => ({
  isOpen: false,
  mode: null,
  open: (mode) => set({ isOpen: true, mode }),
  close: () => set({ isOpen: false, mode: null }),
}))

// ============================================================
// UI Store
// ============================================================
interface UIStore {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  theme: 'light' | 'dark' | 'system'
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  activeVisitId: string | null
  setActiveVisitId: (id: string | null) => void
}

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
      theme: 'light',
      setTheme: (theme) => set({ theme }),
      activeVisitId: null,
      setActiveVisitId: (id) => set({ activeVisitId: id }),
    }),
    { name: 'salesup-ui' }
  )
)

// ============================================================
// Client Store (로컬 캐시)
// ============================================================
interface ClientStore {
  selectedClient: Client | null
  setSelectedClient: (client: Client | null) => void
  recentClients: Client[]
  addRecentClient: (client: Client) => void
}

export const useClientStore = create<ClientStore>((set, get) => ({
  selectedClient: null,
  setSelectedClient: (client) => set({ selectedClient: client }),
  recentClients: [],
  addRecentClient: (client) => {
    const recent = get().recentClients.filter((c) => c.id !== client.id)
    set({ recentClients: [client, ...recent].slice(0, 5) })
  },
}))
