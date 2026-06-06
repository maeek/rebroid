import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Setting } from '@/features/settings/components/setting'
import type { AppFormValues } from './create-app-form.types'

type AppFormSessionSectionProps = {
  values: AppFormValues
  onChange: (patch: Partial<AppFormValues>) => void
}

export const AppFormSessionSection = ({ values, onChange }: AppFormSessionSectionProps) => {
  return (
    <Section
      title='Session'
      contentClassName='gap-4'
      titleClassName='mb-4'
    >
      <Setting
        label='Inactivity timeout'
        description='How long the app can stay idle before it stops automatically. Use -1 for no automatic stop.'
        variant='vertical'
        className='flex-col items-start w-full'
      >
        <Input
          value={values.inactivityTimeoutSeconds}
          min={-1}
          max={86400}
          type='number'
          onChange={event => onChange({ inactivityTimeoutSeconds: Number(event.target.value) })}
        />
      </Setting>
    </Section>
  )
}
