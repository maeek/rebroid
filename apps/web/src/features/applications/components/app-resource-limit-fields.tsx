import { FormField } from '@/components/ui/form-field'
import { NumberSliderField } from '@/components/ui/number-slider-field'
import { verticalSettingClassName } from './app-form-utils'
import type { ResourceLimitBounds } from '@/shared/contracts/system-resources'

type AppResourceLimitFieldsProps = {
  values: {
    memoryLimitMb: string
    cpuLimitCpus: string
  }
  resourceLimits: ResourceLimitBounds | null
  modified?: Partial<Record<'memoryLimitMb' | 'cpuLimitCpus', boolean>>
  onChange: (patch: Partial<{ memoryLimitMb: string; cpuLimitCpus: string }>) => void
  memoryError?: string
  cpuError?: string
}

export const AppResourceLimitFields = ({
  values,
  modified,
  resourceLimits,
  onChange,
  memoryError,
  cpuError
}: AppResourceLimitFieldsProps) => (
  <>
    <FormField
      label='RAM limit'
      resetAction={
        values.memoryLimitMb.trim()
          ? { label: 'Reset RAM limit to default', onReset: () => onChange({ memoryLimitMb: '' }) }
          : undefined
      }
      modified={modified?.memoryLimitMb}
      error={memoryError}
      description='In MB. Blank uses the default.'
      layout='vertical'
      className={verticalSettingClassName}
    >
      <NumberSliderField
        name='memoryLimitMb'
        showSlider={false}
        value={values.memoryLimitMb}
        min={128}
        max={resourceLimits?.maxMemoryMb}
        inputSuffix='MB'
        allowEmpty
        onValueChange={value => onChange({ memoryLimitMb: value })}
      />
    </FormField>
    <FormField
      label='CPU limit'
      resetAction={
        values.cpuLimitCpus.trim()
          ? { label: 'Reset CPU limit to default', onReset: () => onChange({ cpuLimitCpus: '' }) }
          : undefined
      }
      modified={modified?.cpuLimitCpus}
      error={cpuError}
      description='Cores can be fractional. Blank for default.'
      layout='vertical'
      className={verticalSettingClassName}
    >
      <NumberSliderField
        name='cpuLimitCpus'
        showSlider={false}
        value={values.cpuLimitCpus}
        min={0.1}
        max={resourceLimits?.maxCpuCpus}
        step={0.1}
        inputSuffix='cores'
        allowEmpty
        onValueChange={value => onChange({ cpuLimitCpus: value })}
      />
    </FormField>
  </>
)
