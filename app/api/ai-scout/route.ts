import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: NextRequest) {
  try {
    const { fighter } = await req.json()

    const prompt = `Kamu adalah talent scout MMA. Buat laporan scouting singkat dalam Bahasa Indonesia untuk evaluasi calon rekrutan berikut.

Nama: ${fighter.name} "${fighter.nickname}"
Usia: ${fighter.age} tahun, Kelas: ${fighter.weight_class}
Spesialisasi: ${fighter.specialty}, Kepribadian: ${fighter.personality}
Rekor amatir: ${fighter.record.w}-${fighter.record.l}-${fighter.record.d}
Atribut — Striking: ${fighter.attrs.striking}, Grappling: ${fighter.attrs.grappling}, Cardio: ${fighter.attrs.cardio}, Fight IQ: ${fighter.attrs.fight_iq}, Mental: ${fighter.attrs.mental}

Format: 3 bagian singkat — (1) Kekuatan utama, (2) Kelemahan/risiko, (3) Rekomendasi rekrutmen & gaya pengembangan. Total maks 120 kata.`

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const result = await model.generateContent(prompt)
    const text = result.response.text()

    return NextResponse.json({ text })
  } catch (err) {
    console.error('AI Scout error:', err)
    return NextResponse.json({ text: 'Gagal memuat scouting report.' })
  }
}
