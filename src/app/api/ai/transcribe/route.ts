import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOpenAIClient } from '@/lib/openai/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Expected multipart/form-data with an audio file' },
        { status: 400 }
      )
    }

    const openai = getOpenAIClient()
    const formData = await req.formData()
    const audio = formData.get('audio')

    if (!(audio instanceof File) || audio.size === 0) {
      return NextResponse.json({ error: 'No audio file' }, { status: 400 })
    }

    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: 'whisper-1',
      language: 'ko',
    })

    return NextResponse.json({ text: transcription.text })
  } catch (error) {
    console.error('Transcription error:', error)
    const message = error instanceof Error && error.message === 'Missing OPENAI_API_KEY'
      ? 'OPENAI_API_KEY is not configured'
      : 'Transcription failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
