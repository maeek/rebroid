import { IconRestore } from '@tabler/icons-react'
import { MutationButton } from '@/components/ui/mutation-button'
import { Section } from '@/components/ui/section'
import { DetailFields } from '@/shared/ui/detail-fields'
import { OverflowText } from '@/shared/ui/overflow-text'
import { DockerContainerLinks } from '@/shared/ui/platform/docker-container-links'
import { ServiceHealthNotice } from '@/shared/ui/platform/service-health-notice'
import { castingDetailLabels, formatHealthDetail } from './casting-sidecar-utils'
import type { ServiceHealth } from '@/shared/contracts/diagnostics'

const connectionKeys = ['containerName', 'image', 'port', 'publishedHostPort']
const copyableKeys = new Set(['containerName', 'image', 'containerId'])

export const CastingSidecarServiceSection = ({
  loading = false,
  health,
  containerId,
  busy,
  onRestart
}: {
  loading?: boolean
  health: ServiceHealth
  containerId?: string
  busy: string | null
  onRestart: () => void
}) => {
  const details = health.details ?? {}
  const diagnosticKeys = Object.keys(castingDetailLabels).filter(key => !connectionKeys.includes(key) && key in details)
  const fields = [...connectionKeys, ...diagnosticKeys].map(key => {
    const value = details[key]
    const code = copyableKeys.has(key)
    const text = key === 'publishedHostPort' && value === null ? 'Not published' : formatHealthDetail(value)
    return {
      label: castingDetailLabels[key],
      value: key === 'publishedHostPort' && text ? <OverflowText value={text} /> : text,
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
        actions={
          !loading && containerId ? (
            <DockerContainerLinks
              containerId={containerId}
              className='max-sm:flex-col max-sm:items-end'
            />
          ) : undefined
        }
        contentClassName='gap-6'
      >
        <DetailFields
          fields={fields}
          loading={loading}
        />
        <MutationButton
          type='button'
          variant='outline'
          className='self-start'
          pending={busy === 'restart'}
          pendingLabel='Restarting…'
          disabled={loading || (busy !== null && busy !== 'restart')}
          onClick={onRestart}
        >
          <IconRestore className='size-4' />
          Restart sidecar
        </MutationButton>
      </Section>
    </>
  )
}
