import { getRedroidDisplayProfile, redroidDisplayProfiles } from '@rebroid/android-application-core/redroid-runtime'
import { IconAdjustmentsHorizontal, IconDeviceMobile, IconDeviceTablet } from '@tabler/icons-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Section } from '@/components/ui/section'
import { cn } from '@/lib/utils'
import type { CreateAppFormValues } from './create-app-form.types'

type CreateAppDisplaySectionProps = {
  values: CreateAppFormValues
  onChange: (patch: Partial<CreateAppFormValues>) => void
}

export const CreateAppDisplaySection = ({ values, onChange }: CreateAppDisplaySectionProps) => (
  <Section
    surface='plain'
    title='Display size'
    contentClassName='gap-4'
    titleClassName='mb-4'
  >
    <div className='scrollbar-thin grid grid-cols-2 gap-3 overflow-x-hidden max-sm:max-h-[27rem] max-sm:grid-cols-1 max-sm:overflow-y-auto max-sm:pr-1'>
      {redroidDisplayProfiles.map((profile: (typeof redroidDisplayProfiles)[number]) => {
        const selected = values.redroidDisplayProfileId === profile.id
        const Icon = profile.kind === 'tablet' ? IconDeviceTablet : IconDeviceMobile

        return (
          <button
            key={profile.id}
            type='button'
            className={cn(
              'flex min-h-10 items-center gap-3 rounded-panel border p-2 text-left transition-all duration-150',
              'bg-surface-panel/45 hover:border-primary/55 hover:bg-surface-panel/64 dark:shadow-[inset_0_0_10px_0_rgba(255,255,255,0.025)] shadow-[inset_0_0_10px_0_rgba(0,0,0,0.025)]',
              selected
                ? 'border-primary/80 ring-1 ring-primary/30 shadow-[inset_0_0_10px_0_color-mix(in_srgb,var(--primary)_30%,rgba(0,0,0,0))]! dark:shadow-[inset_0_0_10px_0_color-mix(in_srgb,var(--primary)_10%,rgba(0,0,0,0))]!'
                : 'border-surface-border/70'
            )}
            onClick={() => onChange({ redroidDisplayProfileId: profile.id })}
          >
            <span
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-panel border transition-all duration-150',
                selected
                  ? 'border-primary/40 bg-primary/20 text-primary'
                  : 'border-surface-border/70 bg-surface-band/50 text-foreground-muted'
              )}
            >
              <Icon className='size-5' />
            </span>
            <span className='min-w-0'>
              <span className='block font-medium text-sm'>{profile.label}</span>
              <span className='mt-1 block text-xs text-foreground-muted'>{profile.description}</span>
            </span>
          </button>
        )
      })}
      <button
        type='button'
        className={cn(
          'flex min-h-10 items-center gap-3 rounded-panel border p-2 text-left transition-all duration-150',
          'bg-surface-panel/45 hover:border-primary/55 hover:bg-surface-panel/64 dark:shadow-[inset_0_0_10px_0_rgba(255,255,255,0.025)] shadow-[inset_0_0_10px_0_rgba(0,0,0,0.025)]',
          values.redroidDisplayProfileId === 'custom'
            ? 'border-primary/80 ring-1 ring-primary/30 shadow-[inset_0_0_10px_0_color-mix(in_srgb,var(--primary)_30%,rgba(0,0,0,0))]! dark:shadow-[inset_0_0_10px_0_color-mix(in_srgb,var(--primary)_10%,rgba(0,0,0,0))]!'
            : 'border-surface-border/70'
        )}
        onClick={() => {
          const profile = getRedroidDisplayProfile(values.redroidDisplayProfileId)
          const isCustomSelected = values.redroidDisplayProfileId === 'custom'

          onChange({
            redroidDisplayProfileId: 'custom',
            redroidCustomDisplayWidth: isCustomSelected ? values.redroidCustomDisplayWidth : String(profile.width),
            redroidCustomDisplayHeight: isCustomSelected ? values.redroidCustomDisplayHeight : String(profile.height),
            redroidCustomDisplayDpi: isCustomSelected ? values.redroidCustomDisplayDpi : String(profile.dpi)
          })
        }}
      >
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-panel border transition-all duration-150',
            values.redroidDisplayProfileId === 'custom'
              ? 'border-primary/40 bg-primary/20 text-primary'
              : 'border-surface-border/70 bg-surface-band/50 text-foreground-muted'
          )}
        >
          <IconAdjustmentsHorizontal className='size-5' />
        </span>
        <span className='min-w-0'>
          <span className='block font-medium text-sm'>Custom</span>
          <span className='mt-1 block text-xs text-foreground-muted'>
            {values.redroidCustomDisplayWidth || 'Width'} x {values.redroidCustomDisplayHeight || 'height'},{' '}
            {values.redroidCustomDisplayDpi || 'DPI'} dpi
          </span>
        </span>
      </button>
    </div>
    {values.redroidDisplayProfileId === 'custom' ? (
      <div className='grid grid-cols-3 gap-3 pt-1 max-sm:grid-cols-1'>
        <div className='space-y-2'>
          <Label htmlFor='redroid-custom-display-width'>Width</Label>
          <Input
            id='redroid-custom-display-width'
            inputMode='numeric'
            min={1}
            placeholder='1080'
            type='number'
            value={values.redroidCustomDisplayWidth}
            onChange={event => onChange({ redroidCustomDisplayWidth: event.target.value })}
          />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='redroid-custom-display-height'>Height</Label>
          <Input
            id='redroid-custom-display-height'
            inputMode='numeric'
            min={1}
            placeholder='1920'
            type='number'
            value={values.redroidCustomDisplayHeight}
            onChange={event => onChange({ redroidCustomDisplayHeight: event.target.value })}
          />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='redroid-custom-display-dpi'>DPI</Label>
          <Input
            id='redroid-custom-display-dpi'
            inputMode='numeric'
            min={1}
            placeholder='420'
            type='number'
            value={values.redroidCustomDisplayDpi}
            onChange={event => onChange({ redroidCustomDisplayDpi: event.target.value })}
          />
        </div>
      </div>
    ) : null}
  </Section>
)
