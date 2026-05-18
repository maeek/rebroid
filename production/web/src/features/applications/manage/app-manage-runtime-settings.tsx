import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Textarea } from '@/components/ui/textarea'
import { Visible } from '@/components/ui/visible'
import { Setting } from '@/features/settings/components/setting'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

type AppManageRuntimeSettingsProps = {
  app?: AppDefinition
  inactivityTimeoutSeconds: number
  memoryLimitMb: string
  cpuLimitCpus: string
  volumeSizeLimitMb: string
  containerArgs: string
  onInactivityTimeoutChange: (value: number) => void
  onMemoryLimitChange: (value: string) => void
  onCpuLimitChange: (value: string) => void
  onVolumeSizeLimitChange: (value: string) => void
  onContainerArgsChange: (value: string) => void
  canChangeSessionLimit: boolean
  canChangeResources: boolean
  canChangeContainerArgs: boolean
  canViewBackendDetails: boolean
}

const verticalSettingClassName = 'flex-col items-start w-full'

export const AppManageRuntimeSettings = ({
  app,
  inactivityTimeoutSeconds,
  memoryLimitMb,
  cpuLimitCpus,
  volumeSizeLimitMb,
  containerArgs,
  onInactivityTimeoutChange,
  onMemoryLimitChange,
  onCpuLimitChange,
  onVolumeSizeLimitChange,
  onContainerArgsChange,
  canChangeSessionLimit,
  canChangeResources,
  canChangeContainerArgs,
  canViewBackendDetails
}: AppManageRuntimeSettingsProps) => {
  return (
    <Section
      title='Runtime'
      boxed
      titleClassName='pb-4'
      contentClassName='gap-6'
    >
      <Visible when={canViewBackendDetails}>
        <Setting
          label='Image'
          className={verticalSettingClassName}
          variant='vertical'
        >
          <Input
            value={app?.containerImage ?? ''}
            readOnly
          />
        </Setting>
      </Visible>
      <Visible when={canChangeSessionLimit}>
        <Setting
          label='Inactivity timeout'
          className={verticalSettingClassName}
          variant='vertical'
        >
          <Input
            value={inactivityTimeoutSeconds}
            min={60}
            max={86400}
            type='number'
            onChange={event => onInactivityTimeoutChange(Number(event.target.value))}
          />
        </Setting>
      </Visible>
      <Visible when={canChangeResources}>
        <div className='grid grid-cols-3 gap-3 max-md:grid-cols-1'>
          <Setting
            label='RAM limit MB'
            className={verticalSettingClassName}
            variant='vertical'
          >
            <Input
              value={memoryLimitMb}
              type='number'
              min={128}
              onChange={event => onMemoryLimitChange(event.target.value)}
            />
          </Setting>
          <Setting
            label='CPU cores'
            className={verticalSettingClassName}
            variant='vertical'
          >
            <Input
              value={cpuLimitCpus}
              type='number'
              min={0.1}
              step={0.1}
              onChange={event => onCpuLimitChange(event.target.value)}
            />
          </Setting>
          <Setting
            label='Volume MB'
            className={verticalSettingClassName}
            variant='vertical'
          >
            <Input
              value={volumeSizeLimitMb}
              type='number'
              min={16}
              onChange={event => onVolumeSizeLimitChange(event.target.value)}
            />
          </Setting>
        </div>
      </Visible>
      <Visible when={canChangeContainerArgs}>
        <Setting
          label='Container arguments'
          description='Optional Docker Cmd override. Use a long-running command for images that would otherwise exit immediately, for example sleep infinity.'
          className={verticalSettingClassName}
          variant='vertical'
        >
          <Textarea
            value={containerArgs}
            placeholder='sleep infinity'
            onChange={event => onContainerArgsChange(event.target.value)}
          />
        </Setting>
      </Visible>
    </Section>
  )
}
