import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient, hasCompanySchema, upsertProfile } from '@/lib/supabase/admin'

const registerSchema = z.object({
  accountType: z.enum(['personal', 'company']),
  fullName: z.string().trim().min(1, '이름을 입력해주세요.'),
  email: z.string().trim().email('올바른 이메일을 입력해주세요.'),
  password: z.string().min(6, '비밀번호는 6자 이상이어야 합니다.'),
  companyName: z.string().trim().optional(),
  businessNumber: z.string().trim().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const parsed = registerSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || '입력값을 확인해주세요.' },
        { status: 400 }
      )
    }

    const { accountType, fullName, email, password, companyName, businessNumber } = parsed.data

    if (accountType === 'company') {
      if (!companyName) {
        return NextResponse.json({ error: '회사명을 입력해주세요.' }, { status: 400 })
      }
      if (!businessNumber) {
        return NextResponse.json({ error: '사업자등록번호를 입력해주세요.' }, { status: 400 })
      }
    }

    const adminSupabase = createAdminClient()
    const role = accountType === 'company' ? 'COMPANY_ADMIN' : 'PERSONAL_USER'

    const { data: createResult, error: createError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role,
      },
    })

    if (createError || !createResult.user) {
      return NextResponse.json(
        { error: createError?.message || '회원가입에 실패했습니다.' },
        { status: 400 }
      )
    }

    const userId = createResult.user.id

    try {
      let companyId: string | null = null

      await upsertProfile(adminSupabase, {
        id: userId,
        email,
        fullName,
        role,
      })

      if (accountType === 'company') {
        if (!(await hasCompanySchema(adminSupabase))) {
          throw new Error(
            '회사 기능을 사용하려면 Supabase SQL Editor에서 src/lib/supabase/schema.sql을 먼저 실행해야 합니다.'
          )
        }

        const { data: company, error: companyError } = await adminSupabase
          .from('companies')
          .insert({
            name: companyName,
            business_number: businessNumber,
            admin_id: userId,
            is_verified: false,
          })
          .select('id')
          .single()

        if (companyError || !company) {
          throw new Error(companyError?.message || '회사 생성에 실패했습니다.')
        }

        companyId = company.id
      }

      await upsertProfile(adminSupabase, {
        id: userId,
        email,
        fullName,
        role,
        companyId,
      })

      return NextResponse.json({
        success: true,
        userId,
        companyId,
      })
    } catch (error) {
      if (accountType === 'company') {
        await adminSupabase.from('companies').delete().eq('admin_id', userId)
      }
      await adminSupabase.auth.admin.deleteUser(userId)
      throw error
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '회원가입 처리 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
