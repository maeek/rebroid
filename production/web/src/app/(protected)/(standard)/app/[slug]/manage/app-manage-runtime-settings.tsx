import { Setting } from '@/app/(protected)/_components/settings/setting'
import { Input } from '@/components/ui/input'
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
    <Setting
      label='Runtime'
      className={verticalSettingClassName}
      variant='vertical'
    >
      <div className='flex w-full flex-col gap-6'>
        <div className='flex w-full flex-col items-start gap-2'>
          <span className='text-secondary-foreground'>Image</span>
          <Input
            value={app?.redroidImage ?? ''}
            readOnly
          />
        </div>
        <div className='flex w-full flex-col items-start gap-2'>
          <span className='text-secondary-foreground'>Inactivity timeout</span>
          <Input
            value={inactivityTimeoutSeconds}
            min={60}
            max={86400}
            type='number'
            onChange={event => onInactivityTimeoutChange(Number(event.target.value))}
          />
        </div>
        <div className='grid grid-cols-3 gap-3 max-md:grid-cols-1'>
          <div className='flex w-full flex-col items-start gap-2'>
            <span className='text-secondary-foreground'>RAM limit MB</span>
            <Input
              value={memoryLimitMb}
              type='number'
              min={128}
              onChange={event => onMemoryLimitChange(event.target.value)}
            />
          </div>
          <div className='flex w-full flex-col items-start gap-2'>
            <span className='text-secondary-foreground'>CPU cores</span>
            <Input
              value={cpuLimitCpus}
              type='number'
              min={0.1}
              step={0.1}
              onChange={event => onCpuLimitChange(event.target.value)}
            />
          </div>
          <div className='flex w-full flex-col items-start gap-2'>
            <span className='text-secondary-foreground'>Volume MB</span>
            <Input
              value={volumeSizeLimitMb}
              type='number'
              min={16}
              onChange={event => onVolumeSizeLimitChange(event.target.value)}
            />
          </div>
        </div>
        <div className='flex w-full flex-col items-start gap-2'>
          <span className='text-secondary-foreground'>Redroid arguments</span>
          <Textarea
            value={redroidArgs}
            onChange={event => onRedroidArgsChange(event.target.value)}
          />
        </div>
      </div>
    </Setting>
  )
}
