import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  // 프로필 업데이트
  await adminSupabase
    .from('profiles')
    .update({
      role: 'SALES_MEMBER',
      company_id: companyId || profile.company_id,
      username: username || null,
    })
    .eq('id', newUser.user.id)

  return NextResponse.json({ success: true, userId: newUser.user.id })
}
