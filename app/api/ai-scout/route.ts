import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

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

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')

    return NextResponse.json({ text })
  } catch (err) {
    return NextResponse.json({ text: 'Gagal memuat scouting report.' })
  }
}
