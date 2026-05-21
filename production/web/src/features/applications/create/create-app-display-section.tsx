import { IconDeviceMobile, IconDeviceTablet } from '@tabler/icons-react'
import type { CreateAppFormValues } from './create-app-form.types'
import { Section } from '@/components/ui/section'
import { cn } from '@/lib/utils'
import { redroidDisplayProfiles } from '@/shared/runtime/redroid-runtime'

type CreateAppDisplaySectionProps = {
  values: CreateAppFormValues
  onChange: (patch: Partial<CreateAppFormValues>) => void
}

export const CreateAppDisplaySection = ({ values, onChange }: CreateAppDisplaySectionProps) => (
  <Section
    title='Display size'
    boxed
    contentClassName='gap-4'
    titleClassName='mb-4'
  >
    <div className='grid grid-cols-2 gap-3 max-sm:grid-cols-1'>
      {redroidDisplayProfiles.map(profile => {
        const selected = values.redroidDisplayProfileId === profile.id
        const Icon = profile.kind === 'tablet' ? IconDeviceTablet : IconDeviceMobile

        return (
          <button
            key={profile.id}
            type='button'
            className={cn(
              'flex min-h-20 items-center gap-3 rounded-lg border p-4 text-left transition-colors',
              'bg-card/35 hover:border-primary/55 hover:bg-card/55',
              selected ? 'border-primary/80 ring-1 ring-primary/30' : 'border-border/70'
            )}
            onClick={() => onChange({ redroidDisplayProfileId: profile.id })}
          >
            <span
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-lg border',
                selected
                  ? 'border-primary/40 bg-primary/20 text-primary'
                  : 'border-border/70 bg-background/40 text-secondary-foreground'
              )}
            >
              <Icon className='size-5' />
            </span>
            <span className='min-w-0'>
              <span className='block font-medium'>{profile.label}</span>
              <span className='mt-1 block text-xs text-secondary-foreground'>{profile.description}</span>
            </span>
          </button>
        )
      })}
    </div>
  </Section>
)
