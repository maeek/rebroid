import { useEffect, useId, useRef } from 'react'
import {
  applyRedroidDisplayContainerArgs,
  getRedroidDisplayProfile
} from '@rebroid/android-application-core/redroid-runtime'
import { Disclosure, DisclosureSummary, DisclosureChevron } from '@/components/ui/disclosure'
import { EditorFormContext } from '@/components/ui/editor-form-context'
import { FormField } from '@/components/ui/form-field'
import { Section } from '@/components/ui/section'
import { Surface } from '@/components/ui/surface'
import { Textarea } from '@/components/ui/textarea'
import { Visible } from '@/components/ui/visible'
import { AppDisplayPreview } from '@/features/applications/components/app-display-preview'
import { verticalSettingClassName } from '@/features/applications/components/app-form-utils'
import { formatRuntimeArguments } from '@/features/applications/domain/format-runtime-arguments'
import { cn } from '@/lib/utils'
import { CodeViewer } from '@/shared/ui/code-viewer'
import { RuntimeImagePicker } from '@/shared/ui/runtime-image/runtime-image-picker'
import { CreateAppDisplaySection } from './create-app-display-section'
import { getCustomDisplayConfig } from './create-app-form-model'
import type { CreateAppFormValues } from './create-app-form.types'
import type { PlatformImage } from '@/shared/contracts/platform'

type CreateAppDeviceSectionProps = {
  displayFieldErrors?: Record<string, string[]>
  images: PlatformImage[]
  values: CreateAppFormValues
  onChange: (patch: Partial<CreateAppFormValues>) => void
  canChangeBaseImage: boolean
  canChangeContainerArgs: boolean
  isRedroidRuntime: boolean
  imageIncludesGooglePlay?: boolean
  imageError?: string
  argumentsError?: string
}

export const CreateAppDeviceSection = ({
  displayFieldErrors,
  images,
  values,
  onChange,
  canChangeBaseImage,
  canChangeContainerArgs,
  isRedroidRuntime,
  imageIncludesGooglePlay,
  imageError,
  argumentsError
}: CreateAppDeviceSectionProps) => {
  const argumentsSection = useRef<HTMLDetailsElement>(null)
  const googlePlayHintId = useId()
  useEffect(() => {
    if (argumentsError && argumentsSection.current) argumentsSection.current.open = true
  }, [argumentsError])

  const customDisplayConfig =
    values.redroidDisplayProfileId === 'custom' ? (getCustomDisplayConfig(values) ?? undefined) : undefined
  const showDisplay = isRedroidRuntime && canChangeContainerArgs
  const display =
    values.redroidDisplayProfileId === 'custom'
      ? (customDisplayConfig ?? null)
      : getRedroidDisplayProfile(values.redroidDisplayProfileId)
  const redroidArgs =
    applyRedroidDisplayContainerArgs(
      values.containerImage,
      values.redroidDisplayProfileId,
      values.redroidExtraArgs,
      customDisplayConfig,
      'redroid'
    ) ?? ''

  return (
    <Section
      surface='plain'
      className='@container/runtime'
      title={canChangeBaseImage ? 'Runtime' : 'Runtime options'}
      headingSpacing='default'
      contentClassName='gap-6'
    >
      {canChangeBaseImage || showDisplay ? (
        <div
          className={cn(
            'grid items-start gap-4',
            showDisplay && '@min-[42rem]/runtime:grid-cols-2 @min-[42rem]/runtime:gap-x-form-column'
          )}
        >
          <div className='grid min-w-0 gap-4'>
            <Visible when={canChangeBaseImage}>
              <div className='grid min-w-0 gap-1.5'>
                <FormField
                  label='Runtime image'
                  error={imageError}
                  description='Container image used to boot Android.'
                  layout='vertical'
                  className={verticalSettingClassName}
                >
                  <RuntimeImagePicker
                    images={images}
                    value={values.containerImage}
                    aria-describedby={imageIncludesGooglePlay ? googlePlayHintId : undefined}
                    onChange={value => onChange({ containerImage: value })}
                  />
                </FormField>
                {imageIncludesGooglePlay ? (
                  <p
                    id={googlePlayHintId}
                    className='text-xs leading-relaxed text-foreground-muted touch:text-sm/5'
                  >
                    Google Play services included
                  </p>
                ) : null}
              </div>
            </Visible>
            {showDisplay ? (
              <CreateAppDisplaySection
                values={values}
                onChange={onChange}
                fieldErrors={displayFieldErrors}
              />
            ) : null}
          </div>
          {showDisplay ? <AppDisplayPreview display={display} /> : null}
        </div>
      ) : null}
      <Visible when={canChangeContainerArgs}>
        <Disclosure
          ref={argumentsSection}
          className='group'
        >
          <DisclosureSummary className='touch-control flex min-h-9 cursor-pointer list-none items-center gap-2 text-sm font-medium text-foreground-muted hover:text-foreground'>
            <DisclosureChevron
              direction='right'
              className='size-4'
            />
            Runtime arguments
          </DisclosureSummary>
          <EditorFormContext.Provider value={false}>
            <div
              className={cn(
                'grid items-start gap-4 pt-4',
                isRedroidRuntime && '@min-[42rem]/runtime:grid-cols-2 @min-[42rem]/runtime:gap-x-form-column'
              )}
            >
              <div className='grid min-w-0 gap-3'>
                <FormField
                  label={isRedroidRuntime ? 'Additional ReDroid arguments' : 'Container arguments'}
                  error={argumentsError}
                  description={
                    isRedroidRuntime
                      ? 'Override matching androidboot or property values, such as FPS or proxy settings.'
                      : 'Optional Docker Cmd override for images that would otherwise exit.'
                  }
                  layout='vertical'
                  className={verticalSettingClassName}
                >
                  <Textarea
                    className='font-mono'
                    rows={4}
                    spellCheck={false}
                    autoCapitalize='none'
                    value={isRedroidRuntime ? values.redroidExtraArgs : values.customContainerArgs}
                    placeholder={isRedroidRuntime ? 'androidboot.redroid_fps=30' : 'sleep infinity'}
                    onChange={event => {
                      if (isRedroidRuntime) {
                        onChange({ redroidExtraArgs: event.target.value })
                      } else {
                        onChange({ customContainerArgs: event.target.value })
                      }
                    }}
                  />
                </FormField>
                {isRedroidRuntime ? (
                  <p className='text-xs leading-relaxed text-foreground-muted'>
                    Managed ADB uses TCP port 5555. Configure Android GPU rendering in Administration → General.
                  </p>
                ) : null}
              </div>
              {isRedroidRuntime ? (
                <Surface
                  level='control'
                  className='min-w-0 bg-surface-panel p-4'
                >
                  <CodeViewer
                    title='Effective arguments'
                    headingLevel={3}
                    formatLabel='Shell'
                    description='Includes your overrides. Platform rendering settings apply at startup.'
                    output={formatRuntimeArguments(redroidArgs)}
                  />
                </Surface>
              ) : null}
            </div>
          </EditorFormContext.Provider>
        </Disclosure>
      </Visible>
    </Section>
  )
}
