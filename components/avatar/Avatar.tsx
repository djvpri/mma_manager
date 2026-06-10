import { generateAvatarSVG } from '@/lib/avatar'

interface AvatarProps {
  seed: number
  size?: number
  isFemale?: boolean
  className?: string
  imageUrl?: string | null
}

export default function Avatar({ seed, size = 80, isFemale = false, className, imageUrl }: AvatarProps) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt="Foto fighter"
        width={size}
        height={size}
        className={className}
        style={{ width: size, height: size, objectFit: 'cover' }}
      />
    )
  }

  const svg = generateAvatarSVG(seed, size, isFemale)

  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
