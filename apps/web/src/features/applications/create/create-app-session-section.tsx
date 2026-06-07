import { AppRuntimeSection } from '@/features/applications/components/app-runtime-section'
import type { AppFormValues } from './create-app-form.types'

type AppFormSessionSectionProps = {
  values: AppFormValues
  onChange: (patch: Partial<AppFormValues>) => void
}

export const AppFormSessionSection = ({ values, onChange }: AppFormSessionSectionProps) => {
  return (
    <AppRuntimeSection
      values={values}
      onChange={onChange}
    />
  )
}
