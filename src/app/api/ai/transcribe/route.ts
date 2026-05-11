import { NextRequest, NextResponse } from 'next/server'
import { getOpenAIClient } from '@/lib/openai/server'

export async function POST(req: NextRequest) {
  try {
    const openai = getOpenAIClient()
    const formData = await req.formData()
    const audio = formData.get('audio') as File

    if (!audio) {
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
