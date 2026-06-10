import { generateAvatarSVG } from '@/lib/avatar'

interface AvatarProps {
  seed: number
  size?: number
  isFemale?: boolean
  className?: string
}

export default function Avatar({ seed, size = 80, isFemale = false, className }: AvatarProps) {
  const svg = generateAvatarSVG(seed, size, isFemale)

  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
