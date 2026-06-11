interface AvatarProps {
  size?: number
  className?: string
  imageUrl?: string | null
}

export default function Avatar({ size = 80, className, imageUrl }: AvatarProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl || '/fighter-silhouette.png'}
      alt="Foto fighter"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: 'cover' }}
    />
  )
}
