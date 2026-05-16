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
        description='Base Redroid image used to boot the Android runtime for this app.'
        variant='vertical'
        className={verticalSettingClassName}
      >
        <Input
          value={values.redroidImage}
          onChange={event => onChange({ redroidImage: event.target.value })}
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
        label='Redroid arguments'
        description='Optional space-separated boot arguments passed to Redroid, such as DPI or screen size overrides.'
        variant='vertical'
        className={verticalSettingClassName}
      >
        <Textarea
          value={values.redroidArgs}
          placeholder='androidboot.redroid_dpi=480 androidboot.redroid_width=1080'
          onChange={event => onChange({ redroidArgs: event.target.value })}
        />
      </Setting>
    </Section>
  )
}
