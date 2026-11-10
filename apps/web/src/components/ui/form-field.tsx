'use client'

import * as React from 'react'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { EditorFormContext } from './editor-form-context'
import { FormLoadingContext } from './form-loading-boundary'

interface FormFieldProps {
  children: React.ReactNode
  className?: string
  contentClassName?: string
  controlId?: string
  description?: React.ReactNode
  error?: React.ReactNode
  label: React.ReactNode
  layout?: 'vertical' | 'horizontal'
  required?: boolean
  surface?: 'plain' | 'band'
}

type FieldControlProps = {
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: React.AriaAttributes['aria-invalid']
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
  required,
  surface = 'plain'
}: FormFieldProps) => {
  const loading = React.useContext(FormLoadingContext)
  const inEditor = React.useContext(EditorFormContext)
  const fieldLayout = inEditor ? 'vertical' : layout
  const generatedId = React.useId()
  const child = React.isValidElement<FieldControlProps>(children) ? children : null
  const id = controlId ?? child?.props.id ?? generatedId
  const descriptionId = description ? `${id}-description` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [child?.props['aria-describedby'], descriptionId, errorId].filter(Boolean).join(' ') || undefined
  const control = child
    ? React.cloneElement(child, {
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : child.props['aria-invalid']
      })
    : children

  return (
    <div
      data-editor-field={inEditor || undefined}
      className={cn(
        'flex w-full min-w-0',
        fieldLayout === 'vertical'
          ? 'flex-col items-start justify-between gap-3'
          : 'flex-row items-center justify-between gap-4',
        surface === 'band' &&
          !inEditor &&
          'rounded-control border border-surface-border/60 bg-surface-band/30 px-4 py-3',
        className
      )}
    >
      <div className={cn('grid min-w-0 gap-1', fieldLayout === 'horizontal' ? 'flex-1' : 'w-full')}>
        <Label
          htmlFor={id}
          className='leading-5 touch:text-base/6'
        >
          {label}
          {required ? <span className='ml-1 text-xs font-medium text-foreground-muted'>*</span> : null}
        </Label>
        {description ? (
          <p
            id={descriptionId}
            className='text-xs leading-relaxed text-foreground-muted touch:text-sm/5'
          >
            {description}
          </p>
        ) : null}
        {error && fieldLayout === 'horizontal' ? (
          <p
            id={errorId}
            className='text-xs text-danger touch:text-sm/5'
            role='alert'
          >
            {error}
          </p>
        ) : null}
      </div>
      <div
        className={cn(
          'min-w-0 text-sm font-normal',
          fieldLayout === 'vertical' ? 'flex w-full flex-col items-start' : 'flex shrink-0 items-center justify-end',
          contentClassName
        )}
      >
        {loading ? (
          <div className='relative w-full min-w-0'>
            <div
              className={cn(
                'invisible flex min-w-0',
                fieldLayout === 'vertical' ? 'flex-col items-start' : 'items-center justify-end'
              )}
              aria-hidden='true'
              inert
            >
              {control}
            </div>
            <Skeleton className='absolute inset-0' />
          </div>
        ) : (
          control
        )}
        {fieldLayout === 'vertical' && error ? (
          <p
            id={errorId}
            className='mt-1.5 text-xs text-danger touch:text-sm/5'
            role='alert'
          >
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}
