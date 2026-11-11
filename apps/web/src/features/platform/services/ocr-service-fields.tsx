import { Fragment } from 'react'
import { FormField } from '@/components/ui/form-field'
import { FormLoadingBoundary } from '@/components/ui/form-loading-boundary'
import { Input } from '@/components/ui/input'
import { NumericUnitInput } from '@/components/ui/numeric-unit-input'
import { Section } from '@/components/ui/section'
import type { OcrServiceUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

export const OcrServiceFields = ({
  settings,
  disabled,
  loading,
  errors,
  onChange
}: {
  settings: OcrServiceUiSettings
  disabled: boolean
  loading: boolean
  errors?: Partial<Record<keyof OcrServiceUiSettings, string[]>>
  onChange: (patch: Partial<OcrServiceUiSettings>) => void
}) => {
  const FieldsBoundary = loading ? FormLoadingBoundary : Fragment
  return (
    <Section
      surface='panel'
      title='Settings'
      description='Control image preprocessing and text recognition.'
    >
      <FieldsBoundary>
        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
          <FormField
            layout='vertical'
            label='Max image size'
            description='Largest image dimension after resizing.'
            error={errors?.maxImageDimension && 'Enter a whole number from 320 to 4,096 px.'}
          >
            <NumericUnitInput
              unit='px'
              type='number'
              min={320}
              max={4096}
              disabled={disabled}
              value={Number.isNaN(settings.maxImageDimension) ? '' : settings.maxImageDimension}
              onChange={event => onChange({ maxImageDimension: event.target.valueAsNumber })}
            />
          </FormField>
          <FormField
            layout='vertical'
            label='Min confidence'
            description='Discard OCR boxes below this score.'
            error={errors?.minConfidence && 'Enter a number from 0 to 1.'}
          >
            <NumericUnitInput
              unit='/ 1'
              type='number'
              min={0}
              max={1}
              step='any'
              disabled={disabled}
              value={Number.isNaN(settings.minConfidence) ? '' : settings.minConfidence}
              onChange={event => onChange({ minConfidence: event.target.valueAsNumber })}
            />
          </FormField>
          <FormField
            layout='vertical'
            label='Language'
            description='Use the language configured on the deployed OCR sidecar.'
            error={errors?.language && 'Enter a language code of up to 16 characters.'}
          >
            <Input
              disabled={disabled}
              value={settings.language}
              placeholder='en'
              onChange={event => onChange({ language: event.target.value })}
            />
          </FormField>
        </div>
      </FieldsBoundary>
    </Section>
  )
}
