import { AppInactivityTimeoutField } from './app-inactivity-timeout-field'
import { AppResourceLimitFields } from './app-resource-limit-fields'
import type { ResourceLimitBounds } from '@/shared/contracts/system-resources'

type LifecycleValues = {
  inactivityTimeoutSeconds: number
  memoryLimitMb: string
  cpuLimitCpus: string
}

export const AppLifecycleFields = ({
  values,
  resourceLimits,
  onChange,
  showSession,
  showResources,
  errors,
  modified,
  disabled
}: {
  values: LifecycleValues
  resourceLimits: ResourceLimitBounds | null
  onChange: (changes: Partial<LifecycleValues>) => void
  showSession: boolean
  showResources: boolean
  errors?: Partial<Record<keyof LifecycleValues, string | undefined>>
  modified?: Partial<Record<keyof LifecycleValues, boolean>>
  disabled?: boolean
}) => (
  <div className='@container/lifecycle grid gap-4'>
    {showSession ? (
      <AppInactivityTimeoutField
        modified={modified}
        values={values}
        onChange={onChange}
        timeoutError={errors?.inactivityTimeoutSeconds}
        disabled={disabled}
      />
    ) : null}
    {showResources ? (
      <AppResourceLimitFields
        modified={modified}
        values={values}
        resourceLimits={resourceLimits}
        onChange={onChange}
        memoryError={errors?.memoryLimitMb}
        cpuError={errors?.cpuLimitCpus}
        disabled={disabled}
      />
    ) : null}
  </div>
)
