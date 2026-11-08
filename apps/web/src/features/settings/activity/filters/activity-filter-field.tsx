import type { ReactElement } from 'react'
import { FormField } from '@/components/ui/form-field'

export const ActivityFilterField = ({ label, children }: { label: string; children: ReactElement }) => (
  <FormField
    label={label}
    layout='vertical'
  >
    {children}
  </FormField>
)
