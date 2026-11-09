import { AppRuntimeSection } from '@/features/applications/components/app-runtime-section'
import type { AppFormValues } from './create-app-form.types'

type AppFormSessionSectionProps = {
  values: AppFormValues
  onChange: (patch: Partial<AppFormValues>) => void
  timeoutError?: string
}

export const AppFormSessionSection = ({ values, onChange, timeoutError }: AppFormSessionSectionProps) => {
  return (
    <AppRuntimeSection
      values={values}
      onChange={onChange}
      timeoutError={timeoutError}
    />
  )
}
