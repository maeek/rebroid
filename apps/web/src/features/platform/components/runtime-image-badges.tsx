import { Badge } from '@/components/ui/badge'
import { resolvePlatformImageRuntimeMetadata } from '@/shared/model/runtime-image/runtime-image-metadata'
import type { PlatformImage } from '@/shared/contracts/platform-image'

const spoofingLabel = {
  not_applicable: 'Spoofing n/a',
  external_required: 'Spoofing required',
  present_unverified: 'Spoofing unverified',
  verified: 'Spoofing verified'
} as const

const spoofingVariant = {
  not_applicable: 'neutral',
  external_required: 'warning',
  present_unverified: 'warning',
  verified: 'success'
} as const

export const RuntimeImageBadges = ({ image }: { image: PlatformImage }) => {
  const { metadata } = resolvePlatformImageRuntimeMetadata(image)
  const isRedroid = metadata.runtimeKind === 'redroid'

  return (
    <div className='flex flex-wrap items-center gap-1.5'>
      <Badge variant={isRedroid ? 'info' : 'neutral'}>{isRedroid ? 'Redroid' : 'Generic'}</Badge>
      {metadata.androidVersion ? <Badge variant='neutral'>Android {metadata.androidVersion}</Badge> : null}
      {metadata.architecture ? <Badge variant='neutral'>{metadata.architecture}</Badge> : null}
      {metadata.gmsMode === 'microg' ? <Badge variant='success'>microG</Badge> : null}
      {metadata.gmsMode === 'gapps' ? <Badge variant='success'>Google Play</Badge> : null}
      <Badge variant={spoofingVariant[metadata.signatureSpoofing]}>{spoofingLabel[metadata.signatureSpoofing]}</Badge>
    </div>
  )
}
