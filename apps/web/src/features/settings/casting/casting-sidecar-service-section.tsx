import type { ReactNode } from 'react'
import { IconRestore } from '@tabler/icons-react'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { serviceHealthState } from '@/shared/model/diagnostics/service-health'
import { DetailFields } from '@/shared/ui/detail-fields'
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
  const state = serviceHealthState(health)
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
      <Notice
        loading={loading}
        tone={state.tone === 'neutral' ? 'info' : state.tone}
        title={loading ? <Skeleton className='h-5 w-20' /> : state.label}
        description={loading ? <Skeleton className='h-5 w-full max-w-96' /> : state.description}
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
