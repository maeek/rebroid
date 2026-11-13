import { IconRestore } from '@tabler/icons-react'
import { MutationButton } from '@/components/ui/mutation-button'
import { Section } from '@/components/ui/section'
import { DetailFields } from '@/shared/ui/detail-fields'
import { OverflowText } from '@/shared/ui/overflow-text'
import { ServiceConnectionLinks } from '@/shared/ui/platform/service-connection-links'
import { serviceContainerField } from '@/shared/ui/platform/service-container-field'
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
  const containerName = typeof details.containerName === 'string' ? details.containerName : undefined
  const diagnosticKeys = Object.keys(castingDetailLabels).filter(key => !connectionKeys.includes(key) && key in details)
  const fields = [...connectionKeys, ...diagnosticKeys].map(key => {
    if (key === 'containerName' && containerId && containerName) {
      return serviceContainerField({ id: containerId, name: containerName })
    }

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
      <div className='grid justify-items-start gap-3'>
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
        {!loading ? (
          <ServiceConnectionLinks
            containerId={containerId}
            showContainerLink={!containerName}
          />
        ) : null}
      </div>
    </Section>
  )
}
