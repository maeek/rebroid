import { getRedroidDisplayProfile, redroidDisplayProfiles } from '@rebroid/android-application-core/redroid-runtime'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { customDisplayFields } from './create-app-form-model'
import type { CreateAppFormValues } from './create-app-form.types'

type CreateAppDisplaySectionProps = {
  values: CreateAppFormValues
  onChange: (patch: Partial<CreateAppFormValues>) => void
  fieldErrors?: Record<string, string[]>
}

export const CreateAppDisplaySection = ({ values, onChange, fieldErrors }: CreateAppDisplaySectionProps) => {
  const isCustom = values.redroidDisplayProfileId === 'custom'
  const selectedProfile = getRedroidDisplayProfile(values.redroidDisplayProfileId)

  return (
    <div className='grid min-w-0 gap-4'>
      <FormField
        label='Display size'
        layout='vertical'
      >
        <Select
          value={values.redroidDisplayProfileId}
          onValueChange={id => {
            if (id === 'custom' && values.redroidDisplayProfileId !== 'custom') {
              onChange({
                redroidDisplayProfileId: 'custom',
                redroidCustomDisplayWidth: String(selectedProfile.width),
                redroidCustomDisplayHeight: String(selectedProfile.height),
                redroidCustomDisplayDpi: String(selectedProfile.dpi)
              })
              return
            }
            onChange({ redroidDisplayProfileId: id })
          }}
        >
          <SelectTrigger className='w-full'>
            <SelectValue>{isCustom ? 'Custom dimensions' : selectedProfile.label}</SelectValue>
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
      {isCustom ? (
        <div className='grid grid-cols-3 gap-3'>
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
    </div>
  )
}
