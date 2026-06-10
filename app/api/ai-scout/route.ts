import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: NextRequest) {
  try {
    const { fighter, opponent } = await req.json()

    const prompt = `Kamu adalah analis taktik MMA. Buat scouting report singkat dalam Bahasa Indonesia untuk persiapan pertarungan.

Fighter kita: ${fighter.name}
- Spesialisasi: ${fighter.specialty}
- Striking: ${fighter.attrs.striking}, Grappling: ${fighter.attrs.grappling}
- Cardio: ${fighter.attrs.cardio}, Fight IQ: ${fighter.attrs.fight_iq}

Lawan: ${opponent.name}
- Spesialisasi: ${opponent.specialty}
- Striking: ${opponent.attrs.striking}, Grappling: ${opponent.attrs.grappling}

Format: 3 bagian singkat — (1) Keunggulan kita, (2) Ancaman lawan, (3) Rekomendasi game plan. Total maks 150 kata.`

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const result = await model.generateContent(prompt)
    const text = result.response.text()

    return NextResponse.json({ text })
  } catch (err) {
    return NextResponse.json({ text: 'Gagal memuat scouting report.' })
  }
}
