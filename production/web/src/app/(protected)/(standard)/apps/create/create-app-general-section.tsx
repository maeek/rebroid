import { Setting } from '@/app/(protected)/_components/settings/setting'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import type { CreateAppFormValues } from './create-app-form.types'

type CreateAppGeneralSectionProps = {
  values: CreateAppFormValues
  onChange: (patch: Partial<CreateAppFormValues>) => void
  onApkChange: (file: File | null) => void
}

const verticalSettingClassName = 'flex-col items-start w-full'

export const CreateAppGeneralSection = ({ values, onChange, onApkChange }: CreateAppGeneralSectionProps) => {
  return (
    <Section
      title='General'
      contentClassName='gap-4'
    >
      <Setting
        label='Name'
        description='Display name shown in the UI for this app. Minimum 2 characters.'
        variant='vertical'
        className={verticalSettingClassName}
      >
        <Input
          value={values.name}
          required
          minLength={2}
          onChange={event => onChange({ name: event.target.value })}
        />
      </Setting>
      <Setting
        label='APK file'
        description='Optional Android package to upload during creation. Leave empty to provision the app without installing an APK.'
        variant='vertical'
        className={verticalSettingClassName}
      >
        <Input
          type='file'
          accept='.apk,application/vnd.android.package-archive'
          onChange={event => onApkChange(event.target.files?.[0] ?? null)}
        />
      </Setting>
    </Section>
  )
}
