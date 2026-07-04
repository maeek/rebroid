import { Badge } from '@/components/ui/badge'
import { resolvePlatformImageRuntimeMetadata } from '@/features/platform/domain/runtime-image-metadata'
import type { PlatformImage } from '@/server/orchestrator/platform/types'

const spoofingLabel = {
  not_applicable: 'Spoofing n/a',
  external_required: 'Spoofing required',
  present_unverified: 'Spoofing unverified',
  verified: 'Spoofing verified'
} as const

const spoofingVariant = {
  not_applicable: 'secondary',
  external_required: 'warning',
  present_unverified: 'warning',
  verified: 'status'
} as const

export const RuntimeImageBadges = ({ image }: { image: PlatformImage }) => {
  const { metadata } = resolvePlatformImageRuntimeMetadata(image)
  const isRedroid = metadata.runtimeKind === 'redroid'

  return (
    <div className='flex flex-wrap items-center gap-1.5'>
      <Badge variant={isRedroid ? 'default' : 'secondary'}>{isRedroid ? 'Redroid' : 'Generic'}</Badge>
      {metadata.androidVersion ? <Badge variant='secondary'>Android {metadata.androidVersion}</Badge> : null}
      {metadata.architecture ? <Badge variant='secondary'>{metadata.architecture}</Badge> : null}
      {metadata.gmsMode === 'microg' ? <Badge variant='status'>microG</Badge> : null}
      <Badge variant={spoofingVariant[metadata.signatureSpoofing]}>{spoofingLabel[metadata.signatureSpoofing]}</Badge>
    </div>
  )
}
