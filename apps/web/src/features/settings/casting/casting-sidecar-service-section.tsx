import { IconLoader2, IconRestore } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { PlatformDetailRow } from '@/shared/ui/platform/platform-detail-parts'
import { PlatformStatusBanner } from '@/shared/ui/platform/platform-status-banner'
import { castingDetailLabels, castingMessage, formatHealthDetail } from './casting-sidecar-utils'
import type { ServiceHealth } from '@/shared/contracts/diagnostics'

export const CastingSidecarServiceSection = ({
  health,
  busy,
  onRestart
}: {
  health: ServiceHealth
  busy: string | null
  onRestart: () => void
}) => {
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
      status={health.status}
      ok={health.ok}
      message={castingMessage(health.message)}
      actions={
        <Button
          type='button'
          variant='outline'
          disabled={busy !== null}
          onClick={onRestart}
        >
          {busy === 'restart' ? <IconLoader2 className='size-4 animate-spin' /> : <IconRestore className='size-4' />}
          Restart sidecar
        </Button>
      }
      details={details}
    />
  )
}
