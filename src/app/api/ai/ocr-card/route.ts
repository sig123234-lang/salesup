import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getClaudeClient, CLAUDE_MODELS } from '@/lib/claude/client'

interface ExtractedCard {
  name: string
  company: string
  contact_name: string
  phone: string
  email: string
  address: string
  department: string
  position: string
}

const OCR_SYSTEM_PROMPT = `당신은 한국 명함 OCR 전문 AI입니다.
이미지에서 명함 정보를 정확히 추출해 JSON으로 반환합니다.

추출 항목:
- name: 거래처(회사) 등록명 (회사명 + 담당자 직책 조합, 예: "ABC물류 김철수 대리")
- company: 회사명만 ("ABC 물류")
- contact_name: 담당자 이름만 ("김철수")
- phone: 전화번호 (휴대폰 우선, 010-XXXX-XXXX 형식 정규화)
- email: 이메일 주소
- address: 주소 (도로명 우선)
- department: 부서 ("물류팀")
- position: 직책 ("대리")

규칙:
- 누락된 필드는 빈 문자열 ""
- 추측 금지, 이미지에 보이는 텍스트만
- 응답은 마크다운/코드블럭 없이 순수 JSON

응답 형식:
{ "name": "...", "company": "...", "contact_name": "...", "phone": "...", "email": "...", "address": "...", "department": "...", "position": "..." }`

function inferMediaType(file: File): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' {
  const t = file.type.toLowerCase()
  if (t.includes('png')) return 'image/png'
  if (t.includes('webp')) return 'image/webp'
  if (t.includes('gif')) return 'image/gif'
  return 'image/jpeg'
}

function fileExt(file: File): string {
  const t = file.type.toLowerCase()
  if (t.includes('png')) return 'png'
  if (t.includes('webp')) return 'webp'
  if (t.includes('gif')) return 'gif'
  return 'jpg'
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const form = await req.formData()
    const file = form.get('image')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'image file required' }, { status: 400 })
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: '이미지는 10MB 이하만 지원됩니다.' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const mediaType = inferMediaType(file)
    const ext = fileExt(file)
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, 19)
    const storagePath = `${user.id}/${timestamp}.${ext}`

    // 1. Upload original to Storage. Bucket must be 'business-cards'.
    let businessCardUrl: string | null = null
    let storageWarning: string | null = null
    const { error: uploadErr } = await supabase.storage
      .from('business-cards')
      .upload(storagePath, buffer, { contentType: mediaType, upsert: false })
    if (uploadErr) {
      console.warn('ocr-card upload failed (bucket missing?):', uploadErr.message)
      storageWarning = '명함 이미지 저장 실패. 텍스트 정보만 추출됩니다.'
    } else {
      businessCardUrl = storagePath
    }

    // 2. Vision extraction via Claude Sonnet
    const client = getClaudeClient()
    const base64 = buffer.toString('base64')
    const response = await client.messages.create({
      model: CLAUDE_MODELS.chat, // Sonnet for vision
      max_tokens: 1024,
      temperature: 0.1,
      system: OCR_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text: '이 명함의 정보를 위 JSON 스키마로 추출해주세요.',
            },
          ],
        },
      ],
    })

    const text = response.content
      .filter((c): c is Extract<typeof c, { type: 'text' }> => c.type === 'text')
      .map((c) => c.text)
      .join('')
    const firstBrace = text.indexOf('{')
    const lastBrace = text.lastIndexOf('}')
    const jsonText = firstBrace >= 0 ? text.slice(firstBrace, lastBrace + 1) : text
    let extracted: ExtractedCard
    try {
      extracted = JSON.parse(jsonText) as ExtractedCard
    } catch (parseErr) {
      console.error('ocr-card parse error:', parseErr, text)
      return NextResponse.json(
        { error: '명함 인식에 실패했습니다. 다른 이미지로 시도해주세요.' },
        { status: 422 },
      )
    }

    return NextResponse.json({
      data: {
        name: extracted.name ?? '',
        company: extracted.company ?? '',
        contact_name: extracted.contact_name ?? '',
        phone: extracted.phone ?? '',
        email: extracted.email ?? '',
        address: extracted.address ?? '',
        department: extracted.department ?? '',
        position: extracted.position ?? '',
        business_card_url: businessCardUrl,
      },
      storage_warning: storageWarning,
    })
  } catch (err) {
    console.error('ocr-card error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    )
  }
}
