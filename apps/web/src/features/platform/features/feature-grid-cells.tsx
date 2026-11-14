import { IconArrowRight } from '@tabler/icons-react'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { ResourceLink } from '@/shared/ui/resource-link'
import { featureDestination, featureLabel } from './feature-presentation'
import { getEffectiveFeatureStatus } from './feature-status'
import type { FeatureFlagState } from '@/shared/contracts/feature-flags'

export const FeatureIdentity = ({ feature }: { feature?: FeatureFlagState }) => (
  <div
    id={feature?.key}
    className='min-w-0 scroll-mt-[calc(var(--console-top-inset)+2rem)]'
  >
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
  if (loading || !feature) return <Skeleton className='h-5.5 w-20 rounded-full' />
  const status = getEffectiveFeatureStatus(feature)
  const isSyncIssue = ['sync-failed', 'waiting', 'applying', 'restart-required'].includes(status.kind)
  const destination =
    feature.owner === 'display'
      ? { label: 'Check display service', href: '/platform/casting' }
      : { label: 'Check service health', href: '/platform/services' }
  return (
    <div className='grid gap-1'>
      <StatusBadge
        tone={status.tone}
        className='w-fit'
      >
        {status.label}
      </StatusBadge>
      {status.description ? <p className='text-xs leading-5 text-foreground-muted'>{status.description}</p> : null}
      {isSyncIssue ? (
        <p className='text-xs text-foreground-muted'>
          Currently {feature.effective ? 'active' : 'off'}.{' '}
          <ResourceLink href={destination.href}>{destination.label}</ResourceLink>
        </p>
      ) : null}
    </div>
  )
}

export const FeatureManageLink = ({ feature }: { feature: FeatureFlagState }) => {
  const destination = featureDestination(feature)
  if (!destination) return <span className='text-foreground-muted'>—</span>
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
