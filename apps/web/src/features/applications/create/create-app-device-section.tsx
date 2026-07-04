import { redroidDefaultsLabel, redroidDisplayArgsForProfile } from '@rebroid/application-core/redroid-runtime'
import { Fragment } from 'react/jsx-runtime'
import { Badge } from '@/components/ui/badge'
import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { AppContainerRuntimeSection } from '@/features/applications/components/app-container-runtime-section'
import { RuntimeImagePicker } from '@/features/platform/components/runtime-image-picker'
import type { CreateAppFormValues } from './create-app-form.types'
import type { PlatformImage } from '@/server/orchestrator/platform/types'

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
  const redroidDefaultArgs = `${redroidDefaultsLabel} ${redroidDisplayArgsForProfile(values.redroidDisplayProfileId)}`

  return (
    <AppContainerRuntimeSection
      title={
        <div className='flex items-center gap-2'>
          Device{' '}
          <Badge variant={isRedroidRuntime ? 'default' : 'secondary'}>{isRedroidRuntime ? 'Redroid' : 'Custom'}</Badge>
        </div>
      }
      showContainerImage={canChangeBaseImage}
      containerImage={values.containerImage}
      containerImageLabel='Image'
      containerImageDescription='Container image used to boot this managed app runtime. Android images such as redroid are the intended default.'
      onContainerImageChange={value => onChange({ containerImage: value })}
      containerImageSlot={
        <RuntimeImagePicker
          images={images}
          value={values.containerImage}
          onChange={value => onChange({ containerImage: value })}
        />
      }
      showContainerArgs={canChangeContainerArgs}
      containerArgsValue={isRedroidRuntime ? values.redroidExtraArgs : values.customContainerArgs}
      onContainerArgsChange={value => {
        if (isRedroidRuntime) {
          onChange({ redroidExtraArgs: value })
        } else {
          onChange({ customContainerArgs: value })
        }
      }}
      containerArgsLabel={isRedroidRuntime ? 'Additional Redroid arguments' : 'Container arguments'}
      containerArgsDescription={
        isRedroidRuntime
          ? 'Optional additional androidboot or property overrides, for example display size, DPI, FPS, or proxy settings.'
          : 'Optional Docker Cmd override. Use a long-running command for images that would otherwise exit immediately, for example sleep infinity.'
      }
      containerArgsPlaceholder={
        isRedroidRuntime
          ? 'androidboot.redroid_width=1080 androidboot.redroid_height=1920 androidboot.redroid_dpi=480'
          : 'sleep infinity'
      }
    >
      <Visible when={isRedroidRuntime && canChangeContainerArgs}>
        <Section
          title='Redroid base arguments'
          titleClassName='pb-0'
          contentClassName='gap-2'
        >
          <div className='font-bold text-sm text-foreground'>Redroid base arguments</div>
          <div className='rounded-md border border-border/80 bg-surface-panel/38 p-3 text-xs text-muted-foreground'>
            <div className='grid gap-2'>
              <p>
                Applied automatically for Redroid images. The managed ADB endpoint uses TCP port 5555. Extra arguments
                below can override these by using the same key.
              </p>
              <div className='font-mono leading-6'>
                {redroidDefaultArgs.split(' ').map((word, index) => (
                  <Fragment key={`${word}-${index}`}>
                    <span>{word}</span>
                    <br />
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        </Section>
      </Visible>
    </AppContainerRuntimeSection>
  )
}
