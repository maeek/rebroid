import { AppResourceLimitsSection } from '@/features/applications/components/app-resource-limits-section'
import type { AppFormValues } from './create-app-form.types'
import type { ResourceLimitBounds } from '@/shared/contracts/system-resources'

type AppFormResourcesSectionProps = {
  values: AppFormValues
  resourceLimits: ResourceLimitBounds | null
  onChange: (patch: Partial<AppFormValues>) => void
  memoryError?: string
  cpuError?: string
}

export const AppFormResourcesSection = ({
  values,
  resourceLimits,
  onChange,
  memoryError,
  cpuError
}: AppFormResourcesSectionProps) => {
  return (
    <AppResourceLimitsSection
      values={values}
      resourceLimits={resourceLimits}
      onChange={onChange}
      memoryError={memoryError}
      cpuError={cpuError}
    />
  )
}
