import { NumberSliderField } from '@/components/ui/number-slider-field'
import { Section } from '@/components/ui/section'
import { Setting } from '@/features/settings/components/setting'
import type { AppFormValues } from './create-app-form.types'
import type { ResourceLimitBounds } from '@/server/orchestrator/diagnostics/resource-limits'

type AppFormResourcesSectionProps = {
  values: AppFormValues
  resourceLimits: ResourceLimitBounds | null
  onChange: (patch: Partial<AppFormValues>) => void
}

const verticalSettingClassName = 'flex-col items-start w-full'

export const AppFormResourcesSection = ({ values, resourceLimits, onChange }: AppFormResourcesSectionProps) => {
  return (
    <Section
      title='Resources'
      boxed
      contentClassName='gap-4'
      titleClassName='mb-4'
    >
      <Setting
        label='RAM limit'
        description='Optional memory limit in MB for the app container. Leave empty to use the runtime default.'
        variant='vertical'
        className={verticalSettingClassName}
      >
        <NumberSliderField
          value={values.memoryLimitMb}
          min={128}
          max={resourceLimits?.maxMemoryMb}
          placeholder='MB'
          suffix=' MB'
          rangeLabel='RAM limit range'
          allowEmpty
          onValueChange={value => onChange({ memoryLimitMb: value })}
        />
      </Setting>
      <Setting
        label='CPU limit'
        description='Optional CPU quota in cores. Fractional values like 0.5 are allowed.'
        variant='vertical'
        className={verticalSettingClassName}
      >
        <NumberSliderField
          value={values.cpuLimitCpus}
          min={0.1}
          max={resourceLimits?.maxCpuCpus}
          step={0.1}
          placeholder='cores'
          suffix=' cores'
          rangeLabel='CPU limit range'
          allowEmpty
          onValueChange={value => onChange({ cpuLimitCpus: value })}
        />
      </Setting>
      <Setting
        label='Volume limit'
        description='Optional advisory limit for persistent app data storage, measured in MB.'
        variant='vertical'
        className={verticalSettingClassName}
      >
        <NumberSliderField
          value={values.volumeSizeLimitMb}
          min={16}
          max={resourceLimits?.maxVolumeSizeMb}
          placeholder='MB advisory'
          suffix=' MB'
          rangeLabel='Volume limit range'
          allowEmpty
          onValueChange={value => onChange({ volumeSizeLimitMb: value })}
        />
      </Setting>
    </Section>
  )
}
