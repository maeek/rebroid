import { AppInactivityTimeoutField } from './app-inactivity-timeout-field'
import { AppResourceLimitFields } from './app-resource-limit-fields'
import type { AppRuntimeFieldErrors, AppRuntimeFields, AppRuntimeSettingsDraft } from '../model/app-runtime-settings'
import type { ResourceLimitBounds } from '@/shared/contracts/system-resources'

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
  values: AppRuntimeSettingsDraft
  resourceLimits: ResourceLimitBounds | null
  onChange: (changes: Partial<AppRuntimeSettingsDraft>) => void
  showSession: boolean
  showResources: boolean
  errors?: AppRuntimeFieldErrors
  modified?: AppRuntimeFields
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
