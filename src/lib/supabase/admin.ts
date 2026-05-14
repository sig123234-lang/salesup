import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const tableCache = new Map<string, boolean>()
const columnCache = new Map<string, Set<string>>()

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase admin environment variables')
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function hasTable(adminSupabase: SupabaseClient, table: string) {
  if (tableCache.has(table)) {
    return tableCache.get(table)!
  }

  const { error } = await adminSupabase.from(table).select('id').limit(1)
  const exists = !error || !error.message.includes(`Could not find the table 'public.${table}'`)
  tableCache.set(table, exists)

  return exists
}

export async function getExistingColumns(
  adminSupabase: SupabaseClient,
  table: string,
  columns: string[]
) {
  const cacheKey = `${table}:${columns.join(',')}`
  if (columnCache.has(cacheKey)) {
    return columnCache.get(cacheKey)!
  }

  const existing = new Set<string>()

  if (!(await hasTable(adminSupabase, table))) {
    columnCache.set(cacheKey, existing)
    return existing
  }

  for (const column of columns) {
    const { error } = await adminSupabase.from(table).select(column).limit(1)
    if (!error || !error.message.includes(`column ${table}.${column} does not exist`)) {
      existing.add(column)
    }
  }

  columnCache.set(cacheKey, existing)
  return existing
}

export async function hasCompanySchema(adminSupabase: SupabaseClient) {
  const [companiesExists, profileColumns] = await Promise.all([
    hasTable(adminSupabase, 'companies'),
    getExistingColumns(adminSupabase, 'profiles', ['company_id']),
  ])

  return companiesExists && profileColumns.has('company_id')
}

type UpsertProfileParams = {
  id: string
  email: string
  fullName: string
  role: 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'SALES_MEMBER' | 'PERSONAL_USER'
  companyId?: string | null
  username?: string | null
}

export async function upsertProfile(
  adminSupabase: SupabaseClient,
  { id, email, fullName, role, companyId = null, username = null }: UpsertProfileParams
) {
  const existingColumns = await getExistingColumns(adminSupabase, 'profiles', [
    'id',
    'email',
    'full_name',
    'role',
    'company_id',
    'username',
  ])

  const payload: Record<string, string | null> = {}

  if (existingColumns.has('id')) payload.id = id
  if (existingColumns.has('email')) payload.email = email
  if (existingColumns.has('full_name')) payload.full_name = fullName
  if (existingColumns.has('role')) payload.role = role
  if (existingColumns.has('company_id')) payload.company_id = companyId
  if (existingColumns.has('username')) payload.username = username

  const { error } = await adminSupabase.from('profiles').upsert(payload, { onConflict: 'id' })

  if (error) {
    throw new Error(error.message)
  }
}
