import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Visible } from '@/components/ui/visible'
import { safeVibrate } from '@/lib/safe-vibrate'
import { cn } from '@/lib/utils'
import { Slider } from './slider'

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

type NumberSliderFieldProps = {
  value: string
  onValueChange: (value: string) => void
  min: number
  max?: number | null
  step?: number
  placeholder?: string
  suffix?: string
  inputSuffix?: string
  rangeLabel: string
  allowEmpty?: boolean
  clearLabel?: string
  className?: string
}

export const NumberSliderField = ({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  placeholder,
  suffix,
  inputSuffix,
  rangeLabel,
  allowEmpty,
  clearLabel = 'Default',
  className
}: NumberSliderFieldProps) => {
  const hasMax = typeof max === 'number' && Number.isFinite(max) && max >= min
  const sliderMax = hasMax ? Number(max) : undefined
  const numericValue = value.trim() === '' ? NaN : Number(value)
  const sliderValue =
    Number.isFinite(numericValue) && sliderMax !== undefined ? clamp(numericValue, min, sliderMax) : min

  const normalizeOnBlur = () => {
    if (value.trim() === '') {
      return
    }

    const nextValue = Number(value)

    if (!Number.isFinite(nextValue)) {
      onValueChange(allowEmpty ? '' : String(min))
      return
    }

    onValueChange(String(sliderMax !== undefined ? clamp(nextValue, min, sliderMax) : Math.max(nextValue, min)))
  }

  return (
    <div className={cn('flex  w-full gap-3 flex-col', className)}>
      <div className='flex min-w-0 items-center gap-2'>
        <Input
          className='min-w-0'
          value={value}
          min={min}
          max={hasMax ? max : undefined}
          step={step}
          type='number'
          placeholder={placeholder}
          onBlur={normalizeOnBlur}
          onChange={event => onValueChange(event.target.value)}
        />
        <Visible when={inputSuffix}>
          <span className='shrink-0 whitespace-nowrap text-sm text-secondary-foreground'>{inputSuffix}</span>
        </Visible>
        <Visible when={allowEmpty}>
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='h-9'
            onClick={() => onValueChange('')}
          >
            {clearLabel}
          </Button>
        </Visible>
      </div>
      <Visible when={hasMax}>
        <div className='grid w-full gap-2 min-w-0'>
          <Slider
            aria-label={rangeLabel}
            min={min}
            max={sliderMax}
            step={step}
            value={[sliderValue]}
            onValueChange={v => {
              onValueChange(String(v[0]))
              safeVibrate(30)
            }}
            className='min-w-0'
          />
          <div className='flex items-center justify-between text-[11px] leading-none text-muted-foreground'>
            <span>
              {min}
              {suffix}
            </span>
            <span>
              {sliderMax}
              {suffix}
            </span>
          </div>
        </div>
      </Visible>
    </div>
  )
}
