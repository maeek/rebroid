import { IconAdjustments, IconArrowRight } from '@tabler/icons-react'
import { Skeleton, SkeletonMask } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { ResourceLink } from '@/shared/ui/resource-link'
import { featureDestination, featureLabel } from './feature-presentation'
import { getEffectiveFeatureStatus } from './feature-status'
import type { FeatureFlagState } from '@/shared/contracts/feature-flags'

export const FeatureIdentity = ({ feature }: { feature?: FeatureFlagState }) => (
  <div
    id={feature?.key}
    className='flex min-w-0 scroll-mt-24 items-center gap-3'
  >
    <div
      aria-hidden='true'
      className='flex size-9 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary'
    >
      <IconAdjustments className='size-5' />
    </div>
    <div className='grid min-w-0 flex-1 gap-1'>
      {feature ? (
        <>
          <span
            className='font-medium'
            title={feature.key}
          >
            {featureLabel(feature.key)}
          </span>
          <span className='text-xs leading-5 text-foreground-muted'>{feature.description}</span>
        </>
      ) : (
        <>
          <Skeleton className='h-5 w-36 max-w-full' />
          <Skeleton className='h-5 w-full' />
        </>
      )}
    </div>
  </div>
)

export const FeatureAvailability = ({
  feature,
  loading = false
}: {
  feature?: FeatureFlagState
  loading?: boolean
}) => {
  if (!feature)
    return (
      <div className='grid gap-1'>
        <Skeleton className='h-5.5 w-20 rounded-full' />
        <Skeleton className='h-10 w-full' />
      </div>
    )
  const status = getEffectiveFeatureStatus(feature)
  return (
    <div className='grid gap-1'>
      <SkeletonMask
        visible={loading}
        className='w-fit'
      >
        <StatusBadge
          tone={status.tone}
          className='w-fit'
        >
          {status.label}
        </StatusBadge>
      </SkeletonMask>
      <SkeletonMask
        visible={loading}
        className='w-full'
      >
        <span className='block text-xs leading-5 text-foreground-muted'>{status.description}</span>
      </SkeletonMask>
    </div>
  )
}

export const FeatureManageLink = ({ feature }: { feature: FeatureFlagState }) => {
  const destination = featureDestination(feature)
  if (!destination)
    return (
      <span
        className='text-foreground-muted'
        aria-label='Enable this feature to access its tools'
      >
        —
      </span>
    )
  return (
    <ResourceLink
      href={destination.href}
      className='inline-flex min-h-8 items-center gap-2 whitespace-nowrap px-1 focus-visible:ring-inset'
    >
      {destination.label}
      <IconArrowRight
        aria-hidden='true'
        className='size-4 shrink-0'
      />
    </ResourceLink>
  )
}
