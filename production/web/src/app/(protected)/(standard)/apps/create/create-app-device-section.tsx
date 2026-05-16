import { Setting } from '@/app/(protected)/_components/settings/setting'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Textarea } from '@/components/ui/textarea'
import type { CreateAppFormValues } from './create-app-form.types'

type CreateAppDeviceSectionProps = {
  values: CreateAppFormValues
  onChange: (patch: Partial<CreateAppFormValues>) => void
}

const verticalSettingClassName = 'flex-col items-start w-full'

export const CreateAppDeviceSection = ({ values, onChange }: CreateAppDeviceSectionProps) => {
  return (
    <Section
      title='Device'
      boxed
      contentClassName='gap-4'
      collapsible
    >
      <Setting
        label='Image'
        description='Container image used to boot this managed app runtime. Android images such as redroid are the intended default.'
        variant='vertical'
        className={verticalSettingClassName}
      >
        <Input
          value={values.containerImage}
          onChange={event => onChange({ containerImage: event.target.value })}
        />
      </Setting>
      <Setting
        label='Inactivity timeout'
        description='How long the app can stay idle before the orchestrator stops it automatically.'
        variant='vertical'
        className={verticalSettingClassName}
      >
        <Input
          value={values.inactivityTimeoutSeconds}
          min={60}
          max={86400}
          type='number'
          onChange={event => onChange({ inactivityTimeoutSeconds: Number(event.target.value) })}
        />
      </Setting>
      <Setting
        label='Container arguments'
        description='Optional Docker Cmd override. Use a long-running command for images that would otherwise exit immediately, for example sleep infinity.'
        variant='vertical'
        className={verticalSettingClassName}
      >
        <Textarea
          value={values.containerArgs}
          placeholder='sleep infinity'
          onChange={event => onChange({ containerArgs: event.target.value })}
        />
      </Setting>
    </Section>
  )
}
