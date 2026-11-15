import { cn } from '@/lib/utils'
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
  modified
}: {
  values: LifecycleValues
  resourceLimits: ResourceLimitBounds | null
  onChange: (changes: Partial<LifecycleValues>) => void
  showSession: boolean
  showResources: boolean
  errors?: Partial<Record<keyof LifecycleValues, string | undefined>>
  modified?: Partial<Record<keyof LifecycleValues, boolean>>
}) => (
  <div className='@container/lifecycle'>
    <div
      className={cn(
        'grid items-start gap-4',
        showResources && '@min-[36rem]/lifecycle:grid-cols-2 @min-[36rem]/lifecycle:gap-x-form-column',
        showSession && showResources && '@min-[42rem]/lifecycle:grid-cols-3'
      )}
    >
      {showSession ? (
        <div className={cn(showResources && '@min-[36rem]/lifecycle:col-span-2 @min-[42rem]/lifecycle:col-span-1')}>
          <AppInactivityTimeoutField
            modified={modified}
            values={values}
            onChange={onChange}
            timeoutError={errors?.inactivityTimeoutSeconds}
          />
        </div>
      ) : null}
      {showResources ? (
        <AppResourceLimitFields
          modified={modified}
          values={values}
          resourceLimits={resourceLimits}
          onChange={onChange}
          memoryError={errors?.memoryLimitMb}
          cpuError={errors?.cpuLimitCpus}
        />
      ) : null}
    </div>
  </div>
)
