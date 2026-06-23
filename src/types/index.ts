// ============================================================
// SalesUp - Core Type Definitions
// ============================================================

export type UserRole = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'SALES_MEMBER' | 'PERSONAL_USER'

export type SalesStatus =
  | 'NEW_LEAD'
  | 'FIRST_VISIT'
  | 'QUOTE_SENT'
  | 'FOLLOW_UP'
  | 'CONTRACT_IN_PROGRESS'
  | 'CONTRACTED'
  | 'REJECTED'
  | 'POTENTIAL'

export type CallAnalysisResult = {
  price_sensitivity: 'LOW' | 'MEDIUM' | 'HIGH'
  interest_level: 'LOW' | 'MEDIUM' | 'HIGH'
  competitor_mentioned: boolean
  competitor_names: string[]
  contract_probability: number // 0-100
  customer_reaction: string
  recommended_actions: string[]
  follow_up_message: string
  next_contact_date: string | null
  summary: string
  keywords: string[]
  // Extended fields (Claude API)
  next_contact_reason?: string
  next_calendar_event?: {
    title: string
    type: 'CALL' | 'VISIT' | 'MEETING' | 'FOLLOW_UP'
    suggested_start: string | null
    suggested_end: string | null
    is_confirmed: boolean
    notes: string
  } | null
  cs_reminders?: Array<{
    title: string
    due_date: string
    type: 'FOLLOW_UP' | 'OTHER'
  }>
  spin_feedback?: {
    situation: boolean
    problem: boolean
    implication: boolean
    need_payoff: boolean
    coaching_tip: string
  }
  talk_listen_estimate?: {
    salesperson_ratio: number
    feedback: string
  }
}

export type VisitAnalysisResult = {
  summary: string
  issues_found: string[]
  recommended_strategy: string[]
  contract_probability: number
  customer_mood: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
  next_actions: string[]
}

// ============================================================
// Database Types
// ============================================================

export interface Profile {
  id: string
  email: string
  full_name: string
  username?: string | null
  role: UserRole
  company_id: string | null
  avatar_url: string | null
  phone: string | null
  is_active?: boolean
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
  company?: Company
}

export interface Company {
  id: string
  name: string
  business_number: string
  business_license_url: string | null
  logo_url: string | null
  admin_id: string
  is_verified: boolean
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  company_id: string | null
  owner_id: string
  name: string
  industry: string
  address: string | null
  lat: number | null
  lng: number | null
  contact_name: string | null
  phone: string | null
  email: string | null
  memo: string | null
  photo_url: string | null
  business_card_url: string | null
  sales_status: SalesStatus
  custom_fields: Record<string, unknown>
  tags: string[]
  contract_probability: number
  last_contacted_at: string | null
  next_contact_at: string | null
  created_at: string
  updated_at: string
  // Joined
  owner?: Profile
  activities?: Activity[]
  calls?: CallRecord[]
  visits?: VisitRecord[]
}

export interface Activity {
  id: string
  client_id: string
  user_id: string
  type: 'NOTE' | 'CALL' | 'VISIT' | 'EMAIL' | 'STATUS_CHANGE' | 'AI_INSIGHT'
  content: string
  metadata: Record<string, unknown>
  created_at: string
  // Joined
  user?: Profile
}

export interface CallRecord {
  id: string
  client_id: string
  user_id: string
  company_id: string | null
  duration_seconds: number | null
  audio_url: string | null
  transcript: string | null
  analysis: CallAnalysisResult | null
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  created_at: string
  // Joined
  client?: Client
  user?: Profile
}

export interface VisitRecord {
  id: string
  client_id: string
  user_id: string
  company_id: string | null
  started_at: string
  ended_at: string | null
  lat: number | null
  lng: number | null
  audio_url: string | null
  transcript: string | null
  analysis: VisitAnalysisResult | null
  status: 'IN_PROGRESS' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  created_at: string
  // Joined
  client?: Client
  user?: Profile
}

export type CalendarEventSource =
  | 'manual'
  | 'ai_analysis'
  | 'ai_recommendation'
  | 'quick_capture'
  | 'cs_reminder'
  | 'followup_sequence'

export interface CalendarEvent {
  id: string
  user_id: string
  company_id: string | null
  client_id: string | null
  title: string
  description: string | null
  start_at: string
  end_at: string
  type: 'CALL' | 'VISIT' | 'MEETING' | 'FOLLOW_UP' | 'OTHER'
  is_ai_generated: boolean
  is_completed: boolean
  source: CalendarEventSource | null
  created_at: string
  // Joined
  client?: Client
}

export interface Claim {
  id: string
  client_id: string
  user_id: string
  company_id: string | null
  type: string
  description: string
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  resolved_at: string | null
  resolution: string | null
  created_at: string
  updated_at: string
  // Joined
  client?: Client
  user?: Profile
}

export interface AIRecommendation {
  id: string
  user_id: string
  client_id: string
  type: 'REVISIT' | 'FOLLOW_UP' | 'UPSELL' | 'RETENTION'
  reason: string
  score: number // 0-100
  expires_at: string
  is_dismissed: boolean
  created_at: string
  // Joined
  client?: Client
}

// ============================================================
// UI / Store Types
// ============================================================

export interface KanbanColumn {
  id: SalesStatus
  title: string
  color: string
  clients: Client[]
}

export interface QuickCaptureMode {
  isOpen: boolean
  mode: 'VOICE' | 'NOTE' | 'CLIENT' | 'EVENT' | 'CARD' | null
}

export interface MapFilter {
  status: SalesStatus | 'ALL'
  radius: number
  showRoute: boolean
}

export interface DashboardStats {
  total_clients: number
  contracted: number
  in_progress: number
  today_visits: number
  this_month_contracts: number
  conversion_rate: number
  pending_followups: number
}

// ============================================================
// Dashboard Widget System
// ============================================================

export type WidgetId =
  | 'daily-brief'
  | 'stats'
  | 'recent-clients'
  | 'calendar'
  | 'ai-tip'
  | 'kanban-preview'
  | 'followup-alert'
  | 'cs-reminder'
  | 'followup-counter'
  | 'goal-tracker'
  | 'competitor-intel'
  | 'daily-report'

export interface WidgetConfig {
  id: WidgetId
  enabled: boolean
}

// ============================================================
// Kanban Column Config
// ============================================================

export interface KanbanColumnConfig {
  id: SalesStatus
  enabled: boolean
}

export const DEFAULT_KANBAN_CONFIG: KanbanColumnConfig[] = [
  { id: 'NEW_LEAD', enabled: true },
  { id: 'FIRST_VISIT', enabled: true },
  { id: 'QUOTE_SENT', enabled: true },
  { id: 'FOLLOW_UP', enabled: true },
  { id: 'CONTRACT_IN_PROGRESS', enabled: true },
  { id: 'CONTRACTED', enabled: true },
  { id: 'POTENTIAL', enabled: false },
  { id: 'REJECTED', enabled: false },
]

export const DEFAULT_WIDGET_CONFIG: WidgetConfig[] = [
  { id: 'daily-brief', enabled: true },
  { id: 'stats', enabled: true },
  { id: 'recent-clients', enabled: true },
  { id: 'calendar', enabled: true },
  { id: 'ai-tip', enabled: true },
  { id: 'kanban-preview', enabled: true },
  { id: 'followup-alert', enabled: true },
  { id: 'cs-reminder', enabled: true },
  { id: 'followup-counter', enabled: true },
  { id: 'goal-tracker', enabled: false },
  { id: 'competitor-intel', enabled: false },
  { id: 'daily-report', enabled: false },
]

// ============================================================
// Client Detail Section Config
// ============================================================

export type ClientDetailSectionId = 'info' | 'actions' | 'meddic' | 'tabs'

export interface ClientDetailSectionConfig {
  id: ClientDetailSectionId
  enabled: boolean
}

export const DEFAULT_CLIENT_DETAIL_SECTIONS: ClientDetailSectionConfig[] = [
  { id: 'info', enabled: true },
  { id: 'actions', enabled: true },
  { id: 'meddic', enabled: true },
  { id: 'tabs', enabled: true },
]

// ============================================================
// AI Chat
// ============================================================

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

// ============================================================
// MEDDIC
// ============================================================

export interface MEDDIC {
  metrics?: string
  economic_buyer?: string
  decision_criteria?: string
  decision_process?: string
  identify_pain?: string
  champion?: string
}

// ============================================================
// Admin Dashboard Widget Config
// ============================================================

export type AdminDashboardWidgetId =
  | 'stats'
  | 'team-members'
  | 'monthly-chart'
  | 'status-pie'
  | 'member-activity'
  | 'top-clients'

export interface AdminDashboardWidgetConfig {
  id: AdminDashboardWidgetId
  enabled: boolean
}

export const DEFAULT_ADMIN_DASHBOARD_WIDGETS: AdminDashboardWidgetConfig[] = [
  { id: 'stats', enabled: true },
  { id: 'team-members', enabled: true },
  { id: 'monthly-chart', enabled: true },
  { id: 'status-pie', enabled: true },
  { id: 'member-activity', enabled: true },
  { id: 'top-clients', enabled: true },
]

// ============================================================
// AI Insights Widget Config
// ============================================================

export type AIInsightsWidgetId = 'stats' | 'recommendations'

export interface AIInsightsWidgetConfig {
  id: AIInsightsWidgetId
  enabled: boolean
}

export const DEFAULT_AI_INSIGHTS_WIDGETS: AIInsightsWidgetConfig[] = [
  { id: 'stats', enabled: true },
  { id: 'recommendations', enabled: true },
]

// ============================================================
// Sidebar Nav Config (id is href)
// ============================================================

export interface NavItemConfig {
  id: string
  enabled: boolean
}
