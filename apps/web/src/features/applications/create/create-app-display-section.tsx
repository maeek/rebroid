import { getRedroidDisplayProfile, redroidDisplayProfiles } from '@rebroid/android-application-core/redroid-runtime'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { customDisplayFields } from './create-app-form-model'
import type { CreateAppFormValues } from './create-app-form.types'

type CreateAppDisplaySectionProps = {
  values: CreateAppFormValues
  onChange: (patch: Partial<CreateAppFormValues>) => void
  fieldErrors?: Record<string, string[]>
}

const displayLabel = (id: string) => {
  if (id === 'custom') return 'Custom dimensions'
  const profile = getRedroidDisplayProfile(id)
  return `${profile.label} · ${profile.description}`
}

export const CreateAppDisplaySection = ({ values, onChange, fieldErrors }: CreateAppDisplaySectionProps) => (
  <Section
    surface='plain'
    contentClassName='gap-4'
  >
    <FormField
      label='Display size'
      layout='vertical'
    >
      <Select
        value={values.redroidDisplayProfileId}
        onValueChange={id => {
          if (id === 'custom' && values.redroidDisplayProfileId !== 'custom') {
            const profile = getRedroidDisplayProfile(values.redroidDisplayProfileId)
            onChange({
              redroidDisplayProfileId: 'custom',
              redroidCustomDisplayWidth: String(profile.width),
              redroidCustomDisplayHeight: String(profile.height),
              redroidCustomDisplayDpi: String(profile.dpi)
            })
            return
          }
          onChange({ redroidDisplayProfileId: id })
        }}
      >
        <SelectTrigger className='w-full'>
          <SelectValue>{displayLabel(values.redroidDisplayProfileId)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {redroidDisplayProfiles.map(profile => (
            <SelectItem
              key={profile.id}
              value={profile.id}
            >
              {profile.label} · {profile.description}
            </SelectItem>
          ))}
          <SelectItem value='custom'>Custom dimensions</SelectItem>
        </SelectContent>
      </Select>
    </FormField>
    {values.redroidDisplayProfileId === 'custom' ? (
      <div className='grid'>
        {customDisplayFields.map(([label, key]) => (
          <FormField
            key={key}
            label={label}
            error={fieldErrors?.[key]?.join(' ')}
            layout='vertical'
          >
            <Input
              type='number'
              min={1}
              value={values[key]}
              onChange={event => onChange({ [key]: event.target.value })}
            />
          </FormField>
        ))}
      </div>
    ) : null}
  </Section>
)
