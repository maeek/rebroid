'use client'

import { useContext, useId, type ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Visible } from '@/components/ui/visible'
import { formatDisplayNumber } from '@/lib/format'
import { safeVibrate } from '@/lib/safe-vibrate'
import { cn } from '@/lib/utils'
import { FormLoadingContext } from './form-loading-boundary'
import { Skeleton } from './skeleton'
import { Slider } from './slider'

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const lastSliderStep = (min: number, max: number, step: number) => {
  const steps = Math.floor(Number(((max - min) / step).toPrecision(15)))
  return Math.min(max, Number((min + steps * step).toPrecision(15)))
}

type NumberFieldBaseProps = {
  id?: string
  name?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  value: string
  onValueChange: (value: string) => void
  min: number
  max?: number | null
  step?: number
  placeholder?: string
  suffix?: string
  inputSuffix?: string
  inputNote?: ReactNode
  boundsPending?: boolean
  layout?: 'stacked' | 'side-by-side'
  allowEmpty?: boolean
  clampOnBlur?: boolean
  className?: string
  disabled?: boolean
  loading?: boolean
}

type NumberSliderFieldProps = NumberFieldBaseProps &
  (
    | {
        showSlider?: true
        rangeLabel: string
      }
    | {
        showSlider: false
        rangeLabel?: never
      }
  )

export const NumberSliderField = ({
  id,
  name,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  value,
  onValueChange,
  min,
  max,
  step = 1,
  placeholder,
  suffix,
  inputSuffix,
  inputNote,
  boundsPending = false,
  layout = 'stacked',
  rangeLabel,
  showSlider = true,
  allowEmpty,
  clampOnBlur = true,
  className,
  disabled,
  loading: loadingProp = false
}: NumberSliderFieldProps) => {
  const formLoading = useContext(FormLoadingContext)
  const loading = loadingProp || formLoading
  const noteId = useId()
  const sideBySide = layout === 'side-by-side'
  const inputMax = typeof max === 'number' && Number.isFinite(max) && max >= min ? max : undefined
  const sliderMax = inputMax === undefined ? min : lastSliderStep(min, inputMax, step)
  const empty = value.trim() === ''
  const numericValue = empty ? NaN : Number(value)
  const sliderValue = Number.isFinite(numericValue) ? clamp(numericValue, min, sliderMax) : min
  const pending = loading || boundsPending

  const normalizeOnBlur = () => {
    if (ariaInvalid || empty) {
      return
    }

    const nextValue = Number(value)

    if (!Number.isFinite(nextValue)) {
      onValueChange(allowEmpty ? '' : String(min))
      return
    }

    onValueChange(String(inputMax === undefined ? Math.max(nextValue, min) : clamp(nextValue, min, inputMax)))
  }

  const number = (
    <div className={cn('flex min-w-0 items-center gap-2', sideBySide && '@min-[29rem]/number-field:col-start-2')}>
      <div className={cn('min-w-0', sideBySide ? 'w-24 shrink-0' : 'max-w-48 flex-1')}>
        {loading ? (
          <Skeleton className='touch-control h-9 w-full' />
        ) : (
          <Input
            id={id}
            name={name}
            disabled={disabled}
            aria-describedby={
              [ariaDescribedBy, inputNote && !pending ? noteId : null].filter(Boolean).join(' ') || undefined
            }
            aria-invalid={ariaInvalid}
            value={value}
            min={min}
            max={inputMax}
            step={step}
            type='number'
            placeholder={placeholder}
            onBlur={clampOnBlur ? normalizeOnBlur : undefined}
            onChange={event => onValueChange(event.target.value)}
          />
        )}
      </div>
      <Visible when={inputSuffix}>
        <span className='shrink-0 whitespace-nowrap text-sm text-foreground-muted'>{inputSuffix}</span>
      </Visible>
      {inputNote ? (
        <div
          id={pending ? undefined : noteId}
          className='ml-1 min-w-0 text-pretty text-xs leading-4 text-foreground-muted touch:text-sm/5'
        >
          {pending ? <Skeleton className='h-3 w-20 max-w-full' /> : inputNote}
        </div>
      ) : null}
    </div>
  )

  const range =
    showSlider && (pending || sliderMax > min) ? (
      <div className='grid w-full min-w-0 gap-1'>
        {pending ? (
          <>
            <div className='touch-control flex h-9 items-center'>
              <Skeleton className='h-2 w-full' />
            </div>
            <div className='flex justify-between px-0.5'>
              <Skeleton className='h-3 w-12' />
              <Skeleton className='h-3 w-16' />
            </div>
          </>
        ) : (
          <>
            <Slider
              aria-label={rangeLabel}
              disabled={disabled}
              min={min}
              max={sliderMax}
              step={step}
              value={[sliderValue]}
              getAriaValueText={allowEmpty && empty ? () => 'Default' : undefined}
              onValueChange={v => {
                onValueChange(String(v[0]))
                safeVibrate(30)
              }}
              onValueCommit={v => {
                if (allowEmpty && empty && v[0] === min) onValueChange(String(min))
              }}
              className='touch-control min-w-0'
            />
            <div className='flex items-center justify-between px-0.5 text-xs font-medium leading-none text-foreground-subtle'>
              <span>
                {formatDisplayNumber(min)}
                {suffix}
              </span>
              <span>
                {formatDisplayNumber(sliderMax)}
                {suffix}
                {sideBySide ? ' max' : null}
              </span>
            </div>
          </>
        )}
      </div>
    ) : null

  return (
    <div className={cn('w-full min-w-0', sideBySide && '@container/number-field', className)}>
      {sideBySide ? (
        <div className='grid items-start gap-3 @min-[29rem]/number-field:grid-cols-[minmax(0,1fr)_18rem] @min-[29rem]/number-field:gap-x-form-column'>
          {range}
          {number}
        </div>
      ) : (
        <div className='flex flex-col gap-2'>
          {number}
          {range}
        </div>
      )}
    </div>
  )
}
