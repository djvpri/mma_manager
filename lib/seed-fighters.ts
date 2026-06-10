import type { WeightClass, FighterStatus, Specialty, FighterPersonality, FighterAttrs, FighterRecord } from '@/types'

export interface StarterFighter {
  name: string
  nickname: string
  age: number
  hometown: string
  weight_class: WeightClass
  status: FighterStatus
  specialty: Specialty
  personality: FighterPersonality
  attrs: FighterAttrs
  record: FighterRecord
  potential: number
  avatar_seed: number
}

export const STARTER_FIGHTERS: StarterFighter[] = [
  {
    name: 'Bagas Wirawan',
    nickname: 'The Eagle',
    age: 24,
    hometown: 'Jakarta',
    weight_class: 'Lightweight',
    status: 'active',
    specialty: 'Striker',
    personality: 'Hardworker',
    attrs: { striking: 68, grappling: 55, cardio: 70, fight_iq: 60, mental: 62 },
    record: { w: 3, l: 1, d: 0 },
    potential: 78,
    avatar_seed: 1001,
  },
  {
    name: 'Made Wirayuda',
    nickname: 'Tsunami',
    age: 22,
    hometown: 'Denpasar',
    weight_class: 'Welterweight',
    status: 'active',
    specialty: 'Wrestler',
    personality: 'Disciplined',
    attrs: { striking: 58, grappling: 72, cardio: 68, fight_iq: 58, mental: 60 },
    record: { w: 2, l: 0, d: 0 },
    potential: 82,
    avatar_seed: 1002,
  },
  {
    name: 'Reza Pratama',
    nickname: 'Cobra',
    age: 27,
    hometown: 'Surabaya',
    weight_class: 'Featherweight',
    status: 'training',
    specialty: 'Counter Fighter',
    personality: 'Calculated',
    attrs: { striking: 65, grappling: 60, cardio: 62, fight_iq: 70, mental: 66 },
    record: { w: 5, l: 2, d: 0 },
    potential: 75,
    avatar_seed: 1003,
  },
  {
    name: 'Yoga Saputra',
    nickname: 'Badai',
    age: 20,
    hometown: 'Medan',
    weight_class: 'Bantamweight',
    status: 'prospect',
    specialty: 'All-rounder',
    personality: 'Raw Talent',
    attrs: { striking: 55, grappling: 58, cardio: 65, fight_iq: 50, mental: 55 },
    record: { w: 1, l: 0, d: 0 },
    potential: 88,
    avatar_seed: 1004,
  },
  {
    name: 'Fajar Nugroho',
    nickname: 'Tembok',
    age: 30,
    hometown: 'Yogyakarta',
    weight_class: 'Middleweight',
    status: 'active',
    specialty: 'Grappler',
    personality: 'Veteran',
    attrs: { striking: 60, grappling: 75, cardio: 58, fight_iq: 68, mental: 70 },
    record: { w: 8, l: 4, d: 1 },
    potential: 70,
    avatar_seed: 1005,
  },
  {
    name: 'Putu Dharma',
    nickname: 'Halilintar',
    age: 23,
    hometown: 'Bali',
    weight_class: 'Heavyweight',
    status: 'training',
    specialty: 'Striker',
    personality: 'Perfectionist',
    attrs: { striking: 72, grappling: 50, cardio: 55, fight_iq: 58, mental: 58 },
    record: { w: 2, l: 1, d: 0 },
    potential: 80,
    avatar_seed: 1006,
  },
]
