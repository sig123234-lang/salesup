import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient, hasCompanySchema } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const companyCreateSchema = z.object({
  name: z.string().trim().min(1, '회사명을 입력해주세요.'),
  businessNumber: z.string().trim().min(1, '사업자등록번호를 입력해주세요.'),
  logoUrl: z.string().trim().url().optional().or(z.literal('')),
  businessLicenseUrl: z.string().trim().url().optional().or(z.literal('')),
})

const companyUpdateSchema = z.object({
  name: z.string().trim().min(1, '회사명을 입력해주세요.').optional(),
  businessNumber: z.string().trim().min(1, '사업자등록번호를 입력해주세요.').optional(),
  logoUrl: z.string().trim().url().optional().or(z.literal('')),
  businessLicenseUrl: z.string().trim().url().optional().or(z.literal('')),
})

async function getAuthenticatedProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, profile: null }
  }

  const adminSupabase = createAdminClient()
  const schemaReady = await hasCompanySchema(adminSupabase)

  if (!schemaReady) {
    return { user, profile: null, adminSupabase, schemaReady: false }
  }

  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('id, full_name, email, role, company_id')
    .eq('id', user.id)
    .single()

  return { user, profile, adminSupabase, schemaReady: true }
}

const COMPANY_SCHEMA_ERROR =
  '회사 기능을 사용하려면 Supabase SQL Editor에서 src/lib/supabase/schema.sql을 먼저 실행해야 합니다.'

export async function GET() {
  const { user, profile, adminSupabase, schemaReady } = await getAuthenticatedProfile()

  if (!schemaReady) {
    return NextResponse.json({ error: COMPANY_SCHEMA_ERROR }, { status: 503 })
  }

  if (!user || !profile || !adminSupabase) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!profile.company_id) {
    return NextResponse.json({
      company: null,
      members: [],
      role: profile.role,
    })
  }

  const [{ data: company }, { data: members }] = await Promise.all([
    adminSupabase
      .from('companies')
      .select('*')
      .eq('id', profile.company_id)
      .single(),
    adminSupabase
      .from('profiles')
      .select('id, full_name, email, role, phone, is_active, company_id, created_at, updated_at, username, avatar_url')
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: true }),
  ])

  return NextResponse.json({
    company,
    members: members || [],
    role: profile.role,
  })
}

export async function POST(req: NextRequest) {
  const { user, profile, adminSupabase, schemaReady } = await getAuthenticatedProfile()

  if (!schemaReady) {
    return NextResponse.json({ error: COMPANY_SCHEMA_ERROR }, { status: 503 })
  }

  if (!user || !profile || !adminSupabase) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (profile.company_id) {
    return NextResponse.json({ error: '이미 소속된 회사가 있습니다.' }, { status: 409 })
  }

  const parsed = companyCreateSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || '입력값을 확인해주세요.' },
      { status: 400 }
    )
  }

  const { name, businessNumber, logoUrl, businessLicenseUrl } = parsed.data

  const { data: company, error: createError } = await adminSupabase
    .from('companies')
    .insert({
      name,
      business_number: businessNumber,
      admin_id: user.id,
      logo_url: logoUrl || null,
      business_license_url: businessLicenseUrl || null,
      is_verified: false,
    })
    .select('*')
    .single()

  if (createError || !company) {
    return NextResponse.json(
      { error: createError?.message || '회사 생성에 실패했습니다.' },
      { status: 400 }
    )
  }

  const { error: profileError } = await adminSupabase
    .from('profiles')
    .update({
      company_id: company.id,
      role: 'COMPANY_ADMIN',
    })
    .eq('id', user.id)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, company })
}

export async function PATCH(req: NextRequest) {
  const { user, profile, adminSupabase, schemaReady } = await getAuthenticatedProfile()

  if (!schemaReady) {
    return NextResponse.json({ error: COMPANY_SCHEMA_ERROR }, { status: 503 })
  }

  if (!user || !profile || !adminSupabase) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!profile.company_id || !['COMPANY_ADMIN', 'SUPER_ADMIN'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = companyUpdateSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || '입력값을 확인해주세요.' },
      { status: 400 }
    )
  }

  const payload = parsed.data
  const updateData = {
    name: payload.name,
    business_number: payload.businessNumber,
    logo_url: payload.logoUrl === '' ? null : payload.logoUrl,
    business_license_url:
      payload.businessLicenseUrl === '' ? null : payload.businessLicenseUrl,
  }

  const { data: company, error } = await adminSupabase
    .from('companies')
    .update(updateData)
    .eq('id', profile.company_id)
    .select('*')
    .single()

  if (error || !company) {
    return NextResponse.json(
      { error: error?.message || '회사 정보 저장에 실패했습니다.' },
      { status: 400 }
    )
  }

  return NextResponse.json({ success: true, company })
}
