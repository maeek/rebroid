import type { ReactNode } from 'react'

export const FieldValidation = ({ id, error }: { id: string; error?: ReactNode }) => (
  <div
    data-slot='field-validation'
    id={id}
    role='alert'
    className='mt-1.5 w-full min-w-0 break-words text-xs leading-4 text-danger touch:text-sm/5'
  >
    {error}
  </div>
)
