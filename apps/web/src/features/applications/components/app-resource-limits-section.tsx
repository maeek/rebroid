import { NumberSliderField } from '@/components/ui/number-slider-field'
import { Section } from '@/components/ui/section'
import { FormField } from '@/components/ui/form-field'
import { verticalSettingClassName } from './app-form-utils'
import type { ResourceLimitBounds } from '@/shared/contracts/system-resources'

type AppResourceLimitsSectionProps = {
  values: {
    memoryLimitMb: string
    cpuLimitCpus: string
  }
  resourceLimits: ResourceLimitBounds | null
  onChange: (patch: Partial<{ memoryLimitMb: string; cpuLimitCpus: string }>) => void
  title?: string
  descriptionForMemory?: string
  descriptionForCpu?: string
  titleClassName?: string
  contentClassName?: string
}

export const AppResourceLimitsSection = ({
  values,
  resourceLimits,
  onChange,
  title = 'Resources',
  descriptionForMemory = 'Optional memory limit in MB for the app container. Leave empty to use the runtime default.',
  descriptionForCpu = 'Optional CPU quota in cores. Fractional values like 0.5 are allowed.',
  titleClassName = 'mb-4',
  contentClassName = 'gap-4'
}: AppResourceLimitsSectionProps) => {
  return (
    <Section
      surface='plain'
      title={title}
      contentClassName={contentClassName}
      titleClassName={titleClassName}
    >
      <FormField
        label='RAM limit'
        description={descriptionForMemory}
        layout='vertical'
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
      </FormField>
      <FormField
        label='CPU limit'
        description={descriptionForCpu}
        layout='vertical'
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
      </FormField>
    </Section>
  )
}
