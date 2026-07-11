'use client'

import * as React from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface FormFieldProps {
  children: React.ReactNode
  className?: string
  contentClassName?: string
  controlId?: string
  description?: React.ReactNode
  error?: React.ReactNode
  label: string
  layout?: 'vertical' | 'horizontal'
  required?: boolean
}

export const FormField = ({
  children,
  className,
  contentClassName,
  controlId,
  description,
  error,
  label,
  layout = 'horizontal',
  required
}: FormFieldProps) => {
  const generatedId = React.useId()
  const id = controlId ?? generatedId
  const descriptionId = description ? `${id}-description` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined
  const control = React.isValidElement(children)
    ? React.cloneElement(
        children as React.ReactElement<{
          id?: string
          'aria-describedby'?: string
          'aria-invalid'?: boolean
        }>,
        {
          id,
          'aria-describedby': describedBy,
          'aria-invalid': Boolean(error) || undefined
        }
      )
    : children

  return (
    <div
      className={cn(
        'flex w-full gap-4',
        layout === 'vertical' ? 'flex-col items-start' : 'flex-row items-start justify-between',
        className
      )}
    >
      <div className={cn('grid min-w-0 gap-1', layout === 'horizontal' ? 'flex-1' : 'w-full')}>
        <Label htmlFor={id}>
          {label}
          {required ? <span className='ml-1 text-xs font-medium text-foreground-muted'>* (Required)</span> : null}
        </Label>
        {description ? (
          <p
            id={descriptionId}
            className='text-xs leading-relaxed text-foreground-muted'
          >
            {description}
          </p>
        ) : null}
        {error ? (
          <p
            id={errorId}
            className='text-xs text-danger'
            role='alert'
          >
            {error}
          </p>
        ) : null}
      </div>
      <div
        className={cn(
          'text-sm font-normal',
          layout === 'vertical' ? 'flex w-full flex-col items-start' : 'flex shrink-0 items-center justify-end',
          contentClassName
        )}
      >
        {control}
      </div>
    </div>
  )
}
