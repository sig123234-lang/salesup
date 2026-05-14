import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { upsertProfile } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 관리자 권한 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['COMPANY_ADMIN', 'SUPER_ADMIN'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { email, password, fullName, companyId, username } = await req.json()

  // Service role로 멤버 생성
  const { createClient: createServerClient } = await import('@supabase/supabase-js')
  const adminSupabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: 'SALES_MEMBER',
    },
  })

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 })
  }

  try {
    await upsertProfile(adminSupabase, {
      id: newUser.user.id,
      email,
      fullName,
      role: 'SALES_MEMBER',
      companyId: companyId || profile.company_id,
      username: username || null,
    })
  } catch (error) {
    await adminSupabase.auth.admin.deleteUser(newUser.user.id)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '멤버 프로필 생성에 실패했습니다.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, userId: newUser.user.id })
}
