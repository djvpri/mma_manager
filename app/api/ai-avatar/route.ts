import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createServerSupabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const { fighterId, name, nickname, weight_class, specialty, personality } = await req.json()
    if (!fighterId || !name) {
      return NextResponse.json({ error: 'Data fighter tidak lengkap' }, { status: 400 })
    }

    const supabase = createServerSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: fighter } = await supabase
      .from('fighters')
      .select('gym_id')
      .eq('id', fighterId)
      .single()

    if (!fighter) {
      return NextResponse.json({ error: 'Fighter tidak ditemukan' }, { status: 404 })
    }

    const prompt = `Generate one portrait illustration of a professional MMA fighter for a sports management game.
Fighter: ${name} "${nickname}", ${weight_class} division, fighting style: ${specialty}, personality: ${personality}.
Style: gritty digital illustration, dramatic rim lighting, head-and-shoulders framing, plain dark background, no text, no watermark, no logos.`

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image' })

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const parts: any[] = result.response.candidates?.[0]?.content?.parts ?? []
    const imagePart = parts.find((p) => p?.inlineData)

    if (!imagePart?.inlineData) {
      const textPart = parts.find((p) => p?.text)?.text
      console.error('AI Avatar: no image returned', JSON.stringify(result.response))
      return NextResponse.json(
        { error: textPart ? `AI tidak mengembalikan gambar: ${textPart}` : 'AI tidak mengembalikan gambar' },
        { status: 502 }
      )
    }

    const buffer = Buffer.from(imagePart.inlineData.data, 'base64')
    const path = `${fighter.gym_id}/${fighterId}.png`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, buffer, { contentType: 'image/png', upsert: true })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path)
    const avatarUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`

    await supabase.from('fighters').update({ avatar_url: avatarUrl }).eq('id', fighterId)

    return NextResponse.json({ avatar_url: avatarUrl })
  } catch (err) {
    console.error('AI Avatar error:', err)
    const message = err instanceof Error ? err.message : 'Gagal membuat foto fighter'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
