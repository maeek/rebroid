import { applyRedroidDisplayContainerArgs } from '@rebroid/application-core/redroid-runtime'
import { IconChevronRight } from '@tabler/icons-react'
import { FormField } from '@/components/ui/form-field'
import { Section } from '@/components/ui/section'
import { Textarea } from '@/components/ui/textarea'
import { Visible } from '@/components/ui/visible'
import { verticalSettingClassName } from '@/features/applications/components/app-form-utils'
import { RuntimeImagePicker } from '@/shared/ui/runtime-image/runtime-image-picker'
import { getCustomDisplayConfig } from './create-app-form-model'
import type { CreateAppFormValues } from './create-app-form.types'
import type { PlatformImage } from '@/shared/contracts/platform-image'

type CreateAppDeviceSectionProps = {
  images: PlatformImage[]
  values: CreateAppFormValues
  onChange: (patch: Partial<CreateAppFormValues>) => void
  canChangeBaseImage: boolean
  canChangeContainerArgs: boolean
  isRedroidRuntime: boolean
}

export const CreateAppDeviceSection = ({
  images,
  values,
  onChange,
  canChangeBaseImage,
  canChangeContainerArgs,
  isRedroidRuntime
}: CreateAppDeviceSectionProps) => {
  const customDisplayConfig =
    values.redroidDisplayProfileId === 'custom' ? (getCustomDisplayConfig(values) ?? undefined) : undefined
  const redroidDefaultArgs =
    applyRedroidDisplayContainerArgs(
      values.containerImage,
      values.redroidDisplayProfileId,
      '',
      customDisplayConfig,
      'redroid'
    ) ?? ''

  return (
    <Section
      surface='plain'
      title={canChangeBaseImage ? 'Runtime image' : 'Runtime options'}
      titleClassName='mb-4'
      contentClassName='gap-6'
    >
      <Visible when={canChangeBaseImage}>
        <FormField
          label='Image'
          description='Container image used to boot the managed Android runtime.'
          layout='vertical'
          className={verticalSettingClassName}
        >
          <RuntimeImagePicker
            images={images}
            value={values.containerImage}
            onChange={value => onChange({ containerImage: value })}
          />
        </FormField>
      </Visible>

      <Visible when={canChangeContainerArgs}>
        <details className='group border-t border-surface-border/60 pt-4'>
          <summary className='flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-foreground-muted hover:text-foreground'>
            <IconChevronRight className='size-4 transition-transform group-open:rotate-90' />
            Runtime arguments
          </summary>
          <div className='grid gap-5 pt-5'>
            <Visible when={isRedroidRuntime}>
              <div className='grid gap-2 text-xs text-foreground-muted'>
                <p>Effective ReDroid defaults, including the selected display profile:</p>
                <pre className='max-h-44 overflow-auto rounded-control bg-surface-panel/40 px-3 py-2 font-mono leading-5 whitespace-pre-wrap'>
                  {redroidDefaultArgs.split(' ').join('\n')}
                </pre>
                <p>The managed ADB endpoint uses TCP port 5555. Additional values override matching keys.</p>
              </div>
            </Visible>
            <FormField
              label={isRedroidRuntime ? 'Additional ReDroid arguments' : 'Container arguments'}
              description={
                isRedroidRuntime
                  ? 'Optional androidboot or property overrides, such as FPS or proxy settings.'
                  : 'Optional Docker Cmd override for images that would otherwise exit.'
              }
              layout='vertical'
              className={verticalSettingClassName}
            >
              <Textarea
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
          </div>
        </details>
      </Visible>
    </Section>
  )
}
