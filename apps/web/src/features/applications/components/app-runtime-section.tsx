import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Setting } from '@/shared/ui/settings/setting'

type AppRuntimeSectionProps = {
  values: {
    inactivityTimeoutSeconds: number
  }
  onChange: (patch: Partial<{ inactivityTimeoutSeconds: number }>) => void
  title?: string
  description?: string
  titleClassName?: string
  contentClassName?: string
}

export const AppRuntimeSection = ({
  values,
  onChange,
  title = 'Session',
  description = 'How long the app can stay idle before it stops automatically. Use -1 for no automatic stop.',
  titleClassName = 'mb-4',
  contentClassName = 'gap-4'
}: AppRuntimeSectionProps) => {
  return (
    <Section
      title={title}
      contentClassName={contentClassName}
      titleClassName={titleClassName}
    >
      <Setting
        label='Inactivity timeout'
        description={description}
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
