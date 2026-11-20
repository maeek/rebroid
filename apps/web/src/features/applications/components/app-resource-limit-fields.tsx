import { androidApplicationResourceLimits } from '@rebroid/android-application-core/redroid-runtime'
import { FormField } from '@/components/ui/form-field'
import { NumberSliderField } from '@/components/ui/number-slider-field'
import { HostResourceTotal } from '@/shared/ui/platform/host-resource-total'
import { lifecycleFieldClassName } from './app-form-utils'
import type { ResourceLimitBounds } from '@/shared/contracts/system-resources'

const { memoryLimitMb, cpuLimitCpus } = androidApplicationResourceLimits

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
  disabled?: boolean
}

export const AppResourceLimitFields = ({
  values,
  modified,
  resourceLimits,
  onChange,
  memoryError,
  cpuError,
  disabled
}: AppResourceLimitFieldsProps) => (
  <>
    <FormField
      label='RAM limit'
      resetAction={
        !disabled && values.memoryLimitMb.trim()
          ? { label: 'Reset RAM limit to default', onReset: () => onChange({ memoryLimitMb: '' }) }
          : undefined
      }
      modified={modified?.memoryLimitMb}
      error={memoryError}
      description='In MB. Blank uses the default.'
      layout='vertical'
      className={lifecycleFieldClassName}
      controlOwnsLoading
    >
      <NumberSliderField
        name='memoryLimitMb'
        disabled={disabled}
        layout='side-by-side'
        rangeLabel='Adjust RAM limit'
        boundsPending={resourceLimits === null}
        value={values.memoryLimitMb}
        min={memoryLimitMb.min}
        max={Math.min(memoryLimitMb.max, resourceLimits?.maxMemoryMb ?? memoryLimitMb.max)}
        inputSuffix='MB'
        suffix=' MB'
        placeholder='Default'
        inputNote={
          <HostResourceTotal
            resource='ram'
            capacity={resourceLimits}
          />
        }
        allowEmpty
        clampOnBlur={false}
        onValueChange={value => onChange({ memoryLimitMb: value })}
      />
    </FormField>
    <FormField
      label='CPU limit'
      resetAction={
        !disabled && values.cpuLimitCpus.trim()
          ? { label: 'Reset CPU limit to default', onReset: () => onChange({ cpuLimitCpus: '' }) }
          : undefined
      }
      modified={modified?.cpuLimitCpus}
      error={cpuError}
      description='Cores can be fractional. Blank for default.'
      layout='vertical'
      className={lifecycleFieldClassName}
      controlOwnsLoading
    >
      <NumberSliderField
        name='cpuLimitCpus'
        disabled={disabled}
        layout='side-by-side'
        rangeLabel='Adjust CPU limit'
        boundsPending={resourceLimits === null}
        value={values.cpuLimitCpus}
        min={cpuLimitCpus.min}
        max={Math.min(cpuLimitCpus.max, resourceLimits?.maxCpuCpus ?? cpuLimitCpus.max)}
        step={0.1}
        inputSuffix='cores'
        suffix=' cores'
        placeholder='Default'
        inputNote={
          <HostResourceTotal
            resource='cpu'
            capacity={resourceLimits}
          />
        }
        allowEmpty
        clampOnBlur={false}
        onValueChange={value => onChange({ cpuLimitCpus: value })}
      />
    </FormField>
  </>
)
