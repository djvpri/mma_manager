// Procedural avatar generator — same logic as the demo, extracted as utility
// Returns an SVG string from a seed + size

type SkinTone = { base: string; shadow: string; lip: string }

const SKIN_TONES: SkinTone[] = [
  { base: '#C8956B', shadow: '#9A6845', lip: '#A0604A' },
  { base: '#B5784F', shadow: '#8A5332', lip: '#8B4A3A' },
  { base: '#8B5E3C', shadow: '#633D20', lip: '#6B3A28' },
  { base: '#D4A574', shadow: '#A87850', lip: '#B06050' },
  { base: '#A0694A', shadow: '#7A4528', lip: '#7A4038' },
]

const HAIR_COLORS = ['#1A0A00', '#0D0600', '#2A1800', '#111111']

function rng(seed: number) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 4294967296 }
}

export function generateAvatarSVG(seed: number, size = 80, isFemale = false): string {
  const r = rng(seed)
  const skin = SKIN_TONES[Math.floor(r() * SKIN_TONES.length)]
  const hairColor = HAIR_COLORS[Math.floor(r() * HAIR_COLORS.length)]
  const faceW = 58 + Math.floor(r() * 16)
  const faceH = 72 + Math.floor(r() * 16)
  const cx = size / 2, cy = size / 2 + 2
  const hasScar = r() > 0.5
  const hasTape = r() > 0.6
  const hairStyle = Math.floor(r() * 3)
  const facialHair = !isFemale ? Math.floor(r() * 3) : -1
  const mouthY = cy + faceH * 0.25

  const parts: string[] = []

  // neck
  parts.push(`<path d="M${cx - faceW * 0.22} ${cy + faceH * 0.36} L${cx - faceW * 0.15} ${cy + faceH * 0.5} L${cx + faceW * 0.15} ${cy + faceH * 0.5} L${cx + faceW * 0.22} ${cy + faceH * 0.36}" fill="${skin.shadow}"/>`)
  // face
  parts.push(`<ellipse cx="${cx}" cy="${cy}" rx="${faceW / 2}" ry="${faceH / 2}" fill="${skin.base}" stroke="${skin.shadow}" stroke-width="0.5"/>`)
  // hair
  const hairTop = cy - faceH / 2
  if (hairStyle === 0) {
    parts.push(`<rect x="${cx - faceW / 2 - 2}" y="${hairTop}" width="${faceW + 4}" height="${faceH * 0.22}" rx="4" fill="${hairColor}"/>`)
  } else if (hairStyle === 1) {
    parts.push(`<ellipse cx="${cx}" cy="${hairTop + 2}" rx="${faceW / 2 + 3}" ry="${faceH * 0.17}" fill="${hairColor}"/>`)
    parts.push(`<rect x="${cx - faceW / 2 - 2}" y="${hairTop}" width="${faceW + 4}" height="${faceH * 0.26}" rx="5" fill="${hairColor}"/>`)
  } else {
    parts.push(`<path d="M${cx - faceW / 2 - 2} ${cy - faceH * 0.1} Q${cx} ${hairTop - 6} ${cx + faceW / 2 + 2} ${cy - faceH * 0.1} L${cx + faceW / 2} ${cy - faceH * 0.28} Q${cx} ${hairTop} ${cx - faceW / 2} ${cy - faceH * 0.28} Z" fill="${hairColor}"/>`)
  }
  if (isFemale) {
    parts.push(`<path d="M${cx - faceW / 2 - 2} ${cy - faceH * 0.1} Q${cx - faceW / 2 - 7} ${cy + faceH * 0.15} ${cx - faceW / 2 - 5} ${cy + faceH * 0.33}" fill="none" stroke="${hairColor}" stroke-width="7" stroke-linecap="round"/>`)
    parts.push(`<path d="M${cx + faceW / 2 + 2} ${cy - faceH * 0.1} Q${cx + faceW / 2 + 7} ${cy + faceH * 0.15} ${cx + faceW / 2 + 5} ${cy + faceH * 0.33}" fill="none" stroke="${hairColor}" stroke-width="7" stroke-linecap="round"/>`)
  }
  // ears
  parts.push(`<ellipse cx="${cx - faceW / 2 - 3}" cy="${cy - faceH * 0.04}" rx="4" ry="${faceH * 0.09}" fill="${skin.base}" stroke="${skin.shadow}" stroke-width="0.5"/>`)
  parts.push(`<ellipse cx="${cx + faceW / 2 + 3}" cy="${cy - faceH * 0.04}" rx="4" ry="${faceH * 0.09}" fill="${skin.base}" stroke="${skin.shadow}" stroke-width="0.5"/>`)
  // brows
  const browY = cy - faceH * 0.17
  parts.push(`<path d="M${cx - faceW * 0.28} ${browY + 2} Q${cx - faceW * 0.14} ${browY - 2} ${cx - faceW * 0.04} ${browY}" stroke="${hairColor}" stroke-width="${isFemale ? 2 : 3}" fill="none" stroke-linecap="round"/>`)
  parts.push(`<path d="M${cx + faceW * 0.28} ${browY + 2} Q${cx + faceW * 0.14} ${browY - 2} ${cx + faceW * 0.04} ${browY}" stroke="${hairColor}" stroke-width="${isFemale ? 2 : 3}" fill="none" stroke-linecap="round"/>`)
  // eyes
  const eyeY = cy - faceH * 0.07
  const eyeW = faceW * 0.17, eyeH = faceH * 0.065
  ;[-1, 1].forEach(s => {
    const ex = cx + s * faceW * 0.21
    parts.push(`<ellipse cx="${ex}" cy="${eyeY}" rx="${eyeW / 2}" ry="${eyeH / 2}" fill="white"/>`)
    parts.push(`<ellipse cx="${ex}" cy="${eyeY + 1}" rx="${eyeW * 0.3}" ry="${eyeH * 0.36}" fill="#2A1008"/>`)
    parts.push(`<ellipse cx="${ex}" cy="${eyeY + 1}" rx="${eyeW * 0.16}" ry="${eyeH * 0.2}" fill="#0A0A0A"/>`)
  })
  // nose
  const noseY = cy + faceH * 0.07
  const nW = isFemale ? 6 + r() * 3 : 8 + r() * 4
  parts.push(`<ellipse cx="${cx - nW * 0.38}" cy="${noseY + 1}" rx="${nW * 0.3}" ry="${nW * 0.2}" fill="${skin.shadow}" opacity="0.3"/>`)
  parts.push(`<ellipse cx="${cx + nW * 0.38}" cy="${noseY + 1}" rx="${nW * 0.3}" ry="${nW * 0.2}" fill="${skin.shadow}" opacity="0.3"/>`)
  if (hasTape) parts.push(`<rect x="${cx - nW * 0.7}" y="${noseY - 2}" width="${nW * 1.4}" height="3.5" rx="1.5" fill="#F5DEB3" opacity="0.85"/>`)
  // mouth
  const mW = isFemale ? faceW * 0.3 : faceW * 0.34
  parts.push(`<path d="M${cx - mW / 2} ${mouthY} Q${cx} ${mouthY + 3} ${cx + mW / 2} ${mouthY}" fill="none" stroke="${skin.lip}" stroke-width="1.5" stroke-linecap="round"/>`)
  // facial hair
  if (facialHair === 1) {
    for (let i = 0; i < 18; i++) {
      const sx = cx + (r() - 0.5) * faceW * 0.55, sy = cy + faceH * 0.18 + (r() - 0.5) * faceH * 0.22
      parts.push(`<circle cx="${sx}" cy="${sy}" r="0.7" fill="${hairColor}" opacity="0.5"/>`)
    }
  } else if (facialHair === 2) {
    parts.push(`<path d="M${cx - faceW * 0.4} ${cy + faceH * 0.17} Q${cx - faceW * 0.42} ${cy + faceH * 0.4} ${cx} ${cy + faceH * 0.5} Q${cx + faceW * 0.42} ${cy + faceH * 0.4} ${cx + faceW * 0.4} ${cy + faceH * 0.17}" fill="${hairColor}" opacity="0.7"/>`)
  }
  // scar
  if (hasScar) {
    const sx = cx + (r() > 0.5 ? 1 : -1) * faceW * 0.2
    const sy = cy + faceH * 0.05 + r() * faceH * 0.18
    parts.push(`<path d="M${sx - 1} ${sy - 7} L${sx + 1} ${sy + 7}" stroke="#7A4035" stroke-width="1.5" stroke-linecap="round" opacity="0.65"/>`)
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${parts.join('')}</svg>`
}
