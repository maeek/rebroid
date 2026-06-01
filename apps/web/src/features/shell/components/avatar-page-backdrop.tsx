import { BlurredImageBackdrop } from './blurred-image-backdrop'

export const AvatarPageBackdrop = ({ avatarSrc }: { avatarSrc?: string | null }) => {
  return (
    <BlurredImageBackdrop
      imageSrc={avatarSrc}
      opacity={0.08}
    />
  )
}
