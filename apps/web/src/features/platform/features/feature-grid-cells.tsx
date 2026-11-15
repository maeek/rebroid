import { IconAdjustments, IconArrowRight } from '@tabler/icons-react'
import { Skeleton, SkeletonMask } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import { ResourceLink } from '@/shared/ui/resource-link'
import { featureDestination, featureLabel } from './feature-presentation'
import { getEffectiveFeatureStatus } from './feature-status'
import type { FeatureFlagState } from '@/shared/contracts/feature-flags'
import styles from '@/shared/ui/data-grid/data-grid-table.module.css'

export const FeatureIdentity = ({ feature, loading = false }: { feature?: FeatureFlagState; loading?: boolean }) => (
  <div
    id={feature?.key}
    className={cn(
      'flex min-w-0 scroll-mt-[calc(var(--console-top-inset)+2rem)] items-center gap-3',
      styles.settingsStack
    )}
  >
    <div
      aria-hidden='true'
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-control',
        loading ? 'bg-control/60 text-foreground-muted' : 'bg-primary/10 text-primary',
        styles.settingsWideOnly
      )}
    >
      <IconAdjustments className='size-5' />
    </div>
    <div className={cn('grid min-w-0 flex-1 gap-1', styles.settingsStack)}>
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
      {!feature.mutable ? <span className='text-xs text-foreground-muted'>Deployment managed</span> : null}
      <div className={cn((status.kind === 'active' || status.kind === 'off') && styles.settingsWideOnly)}>
        <SkeletonMask
          visible={loading}
          className='w-full'
        >
          <span className='block text-xs leading-5 text-foreground-muted'>{status.description}</span>
        </SkeletonMask>
      </div>
    </div>
  )
}

export const FeatureManageLink = ({ feature }: { feature: FeatureFlagState }) => {
  const destination = featureDestination(feature)
  if (!destination)
    return (
      <span
        data-compact-empty
        className='text-foreground-muted'
      >
        —
      </span>
    )
  return (
    <ResourceLink
      href={destination.href}
      className={cn('inline-flex min-h-8 items-center gap-2 px-1 focus-visible:ring-inset', styles.settingsTouchTarget)}
    >
      {destination.label}
      <IconArrowRight
        aria-hidden='true'
        className='size-4 shrink-0'
      />
    </ResourceLink>
  )
}
