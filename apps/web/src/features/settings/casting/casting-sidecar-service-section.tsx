import type { ReactNode } from 'react'
import { IconRestore } from '@tabler/icons-react'
import { MutationButton } from '@/components/ui/mutation-button'
import { Section } from '@/components/ui/section'
import { DetailFields } from '@/shared/ui/detail-fields'
import { ServiceHealthNotice } from '@/shared/ui/platform/service-health-notice'
import { castingDetailLabels, formatHealthDetail } from './casting-sidecar-utils'
import type { ServiceHealth } from '@/shared/contracts/diagnostics'

const connectionKeys = ['containerName', 'image', 'port', 'publishedHostPort']
const copyableKeys = new Set(['containerName', 'image', 'containerId'])

export const CastingSidecarServiceSection = ({
  loading = false,
  health,
  busy,
  onRestart,
  logs
}: {
  loading?: boolean
  health: ServiceHealth
  busy: string | null
  onRestart: () => void
  logs?: ReactNode
}) => {
  const details = health.details ?? {}
  const diagnosticKeys = Object.keys(castingDetailLabels).filter(key => !connectionKeys.includes(key) && key in details)
  const fields = [...connectionKeys, ...diagnosticKeys].map(key => {
    const value = details[key]
    const code = copyableKeys.has(key)
    return {
      label: castingDetailLabels[key],
      value: key === 'publishedHostPort' && value === null ? 'Not published' : formatHealthDetail(value),
      code,
      copyValue: code && typeof value === 'string' ? value : undefined
    }
  })

  return (
    <>
      <ServiceHealthNotice
        health={health}
        loading={loading}
      />
      <Section
        surface='panel'
        title='Connection'
        description='Managed by your deployment configuration.'
        contentClassName='gap-6'
      >
        <DetailFields
          fields={fields}
          loading={loading}
        />
        <div className='flex flex-wrap items-center gap-2'>
          {logs}
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
        </div>
      </Section>
    </>
  )
}
