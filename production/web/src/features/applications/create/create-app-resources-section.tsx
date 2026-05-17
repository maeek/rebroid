import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Setting } from '@/features/settings/components/setting'
import type { CreateAppFormValues } from './create-app-form.types'

type CreateAppResourcesSectionProps = {
  values: CreateAppFormValues
  onChange: (patch: Partial<CreateAppFormValues>) => void
}

const verticalSettingClassName = 'flex-col items-start w-full'

export const CreateAppResourcesSection = ({ values, onChange }: CreateAppResourcesSectionProps) => {
  return (
    <Section
      title='Resources'
      boxed
      contentClassName='gap-4'
      collapsible
    >
      <Setting
        label='RAM limit'
        description='Optional memory limit in MB for the app container. Leave empty to use the runtime default.'
        variant='vertical'
        className={verticalSettingClassName}
      >
        <Input
          value={values.memoryLimitMb}
          min={128}
          type='number'
          placeholder='MB'
          onChange={event => onChange({ memoryLimitMb: event.target.value })}
        />
      </Setting>
      <Setting
        label='CPU limit'
        description='Optional CPU quota in cores. Fractional values like 0.5 are allowed.'
        variant='vertical'
        className={verticalSettingClassName}
      >
        <Input
          value={values.cpuLimitCpus}
          min={0.1}
          step={0.1}
          type='number'
          placeholder='cores'
          onChange={event => onChange({ cpuLimitCpus: event.target.value })}
        />
      </Setting>
      <Setting
        label='Volume limit'
        description='Optional advisory limit for persistent app data storage, measured in MB.'
        variant='vertical'
        className={verticalSettingClassName}
      >
        <Input
          value={values.volumeSizeLimitMb}
          min={16}
          type='number'
          placeholder='MB advisory'
          onChange={event => onChange({ volumeSizeLimitMb: event.target.value })}
        />
      </Setting>
    </Section>
  )
}
