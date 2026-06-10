import type { Fighter, Opponent } from '@/types'

export const OPPONENT_NAMES = [
  'Rizky Maulana', 'Carlos Medina', 'Kenji Watanabe', 'Andre Oliveira',
  'Yusuf Hidayat', 'Marco Bianchi', 'Dimas Pratama', 'Viktor Volkov',
  'Hassan Al-Rashid', 'Tomás Reyes',
]

export const OPPONENT_COLORS = ['#3B82F6', '#A855F7', '#F59E0B', '#06B6D4', '#EC4899']

export const OPPONENT_SPECIALTIES = ['Striker', 'Grappler', 'All-rounder', 'Counter Fighter', 'Wrestler']

export function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function generateOpponent(myFighter: Fighter): Opponent {
  const avg =
    (myFighter.attrs.striking +
      myFighter.attrs.grappling +
      myFighter.attrs.cardio +
      myFighter.attrs.fight_iq +
      myFighter.attrs.mental) /
    5
  const roll = () => Math.max(35, Math.min(95, Math.round(avg + randInt(-12, 12))))

  return {
    name: OPPONENT_NAMES[randInt(0, OPPONENT_NAMES.length - 1)],
    attrs: {
      striking: roll(),
      grappling: roll(),
      cardio: roll(),
      fight_iq: roll(),
      mental: roll(),
    },
    record: { w: randInt(3, 18), l: randInt(0, 8), d: 0 },
    specialty: OPPONENT_SPECIALTIES[randInt(0, OPPONENT_SPECIALTIES.length - 1)],
    color: OPPONENT_COLORS[randInt(0, OPPONENT_COLORS.length - 1)],
  }
}
