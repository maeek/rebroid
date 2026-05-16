import { Setting } from '@/app/(protected)/_components/settings/setting'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Textarea } from '@/components/ui/textarea'
import type { AppDefinition } from '@/app/(protected)/(standard)/constants'

type AppManageRuntimeSettingsProps = {
  app?: AppDefinition
  inactivityTimeoutSeconds: number
  memoryLimitMb: string
  cpuLimitCpus: string
  volumeSizeLimitMb: string
  redroidArgs: string
  onInactivityTimeoutChange: (value: number) => void
  onMemoryLimitChange: (value: string) => void
  onCpuLimitChange: (value: string) => void
  onVolumeSizeLimitChange: (value: string) => void
  onRedroidArgsChange: (value: string) => void
}

const verticalSettingClassName = 'flex-col items-start w-full'

export const AppManageRuntimeSettings = ({
  app,
  inactivityTimeoutSeconds,
  memoryLimitMb,
  cpuLimitCpus,
  volumeSizeLimitMb,
  redroidArgs,
  onInactivityTimeoutChange,
  onMemoryLimitChange,
  onCpuLimitChange,
  onVolumeSizeLimitChange,
  onRedroidArgsChange
}: AppManageRuntimeSettingsProps) => {
  return (
    <Section
      title='Runtime'
      boxed
      contentClassName='gap-6'
    >
      <Setting
        label='Image'
        className={verticalSettingClassName}
        variant='vertical'
      >
        <Input
          value={app?.redroidImage ?? ''}
          readOnly
        />
      </Setting>
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
      <Setting
        label='Redroid arguments'
        className={verticalSettingClassName}
        variant='vertical'
      >
        <Textarea
          value={redroidArgs}
          onChange={event => onRedroidArgsChange(event.target.value)}
        />
      </Setting>
    </Section>
  )
}
