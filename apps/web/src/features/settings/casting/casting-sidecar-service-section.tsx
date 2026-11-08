import { IconRestore } from '@tabler/icons-react'
import { MutationButton } from '@/components/ui/mutation-button'
import { Skeleton } from '@/components/ui/skeleton'
import { PlatformDetailRow } from '@/shared/ui/platform/platform-detail-parts'
import { PlatformStatusBanner } from '@/shared/ui/platform/platform-status-banner'
import { castingDetailLabels, castingMessage, formatHealthDetail } from './casting-sidecar-utils'
import type { ServiceHealth } from '@/shared/contracts/diagnostics'

export const CastingSidecarServiceSection = ({
  loading = false,
  health,
  busy,
  onRestart
}: {
  loading?: boolean
  health: ServiceHealth
  busy: string | null
  onRestart: () => void
}) => {
  const loadingDetails = (
    <div className='grid gap-x-8 xl:grid-cols-2'>
      {['Container name', 'Image', 'Port', 'Published host port'].map(label => (
        <PlatformDetailRow
          key={label}
          label={label}
          value={<Skeleton className='my-0.5 h-4 w-48 max-w-full' />}
        />
      ))}
    </div>
  )
  const details = health.details ? (
    <div className='grid gap-x-8 xl:grid-cols-2'>
      {Object.entries(health.details).map(([key, value]) => (
        <PlatformDetailRow
          key={key}
          label={castingDetailLabels[key] ?? key}
          value={formatHealthDetail(value)}
        />
      ))}
    </div>
  ) : undefined

  return (
    <PlatformStatusBanner
      loading={loading}
      status={health.status}
      ok={health.ok}
      message={castingMessage(health.message)}
      actions={
        <MutationButton
          type='button'
          variant='outline'
          pending={busy === 'restart'}
          pendingLabel='Restarting…'
          disabled={loading || (busy !== null && busy !== 'restart')}
          onClick={onRestart}
        >
          <IconRestore className='size-4' />
          Restart sidecar
        </MutationButton>
      }
      details={loading ? loadingDetails : details}
    />
  )
}
