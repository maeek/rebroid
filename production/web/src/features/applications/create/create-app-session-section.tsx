import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Setting } from '@/features/settings/components/setting'
import type { CreateAppFormValues } from './create-app-form.types'

type CreateAppSessionSectionProps = {
  values: CreateAppFormValues
  onChange: (patch: Partial<CreateAppFormValues>) => void
}

export const CreateAppSessionSection = ({ values, onChange }: CreateAppSessionSectionProps) => {
  return (
    <Section
      title='Session'
      boxed
      contentClassName='gap-4'
    >
      <Setting
        label='Inactivity timeout'
        description='How long the app can stay idle before the orchestrator stops it automatically.'
        variant='vertical'
        className='flex-col items-start w-full'
      >
        <Input
          value={values.inactivityTimeoutSeconds}
          min={60}
          max={86400}
          type='number'
          onChange={event => onChange({ inactivityTimeoutSeconds: Number(event.target.value) })}
        />
      </Setting>
    </Section>
  )
}
