import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Textarea } from '@/components/ui/textarea'
import { Visible } from '@/components/ui/visible'
import { Setting } from '@/features/settings/components/setting'
import { redroidDefaultsLabel, redroidDisplayArgsForProfile } from '@/shared/runtime/redroid-runtime'
import type { CreateAppFormValues } from './create-app-form.types'

type CreateAppDeviceSectionProps = {
  values: CreateAppFormValues
  onChange: (patch: Partial<CreateAppFormValues>) => void
  canChangeBaseImage: boolean
  canChangeContainerArgs: boolean
  isRedroidRuntime: boolean
}

const verticalSettingClassName = 'flex-col items-start w-full'

export const CreateAppDeviceSection = ({
  values,
  onChange,
  canChangeBaseImage,
  canChangeContainerArgs,
  isRedroidRuntime
}: CreateAppDeviceSectionProps) => {
  return (
    <Section
      title={
        <div className='flex items-center gap-2'>
          Device{' '}
          <Badge variant={isRedroidRuntime ? 'default' : 'secondary'}>{isRedroidRuntime ? 'Redroid' : 'Custom'}</Badge>
        </div>
      }
      boxed
      contentClassName='gap-4'
      titleClassName='mb-4'
    >
      <Visible when={canChangeBaseImage}>
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
      </Visible>
      <Visible when={isRedroidRuntime && canChangeContainerArgs}>
        <Setting
          label='Redroid base arguments'
          description='Applied automatically for Redroid images. The managed ADB endpoint uses TCP port 5555. Extra arguments below can override these by using the same key.'
          variant='vertical'
          className={verticalSettingClassName}
        >
          <div className='py-2 font-mono text-xs text-muted-foreground'>
            {`${redroidDefaultsLabel} ${redroidDisplayArgsForProfile(values.redroidDisplayProfileId)}`
              .split(' ')
              .map((word, index) => (
                <>
                  <span key={index}>{word}</span>
                  <br />
                </>
              ))}
          </div>
        </Setting>
      </Visible>
      <Visible when={isRedroidRuntime && canChangeContainerArgs}>
        <Setting
          label='Additional Redroid arguments'
          description='Optional additional androidboot or property overrides, for example display size, DPI, FPS, or proxy settings.'
          variant='vertical'
          className={verticalSettingClassName}
        >
          <Textarea
            value={values.redroidExtraArgs}
            placeholder='androidboot.redroid_width=1080 androidboot.redroid_height=1920 androidboot.redroid_dpi=480'
            onChange={event => onChange({ redroidExtraArgs: event.target.value })}
          />
        </Setting>
      </Visible>
      <Visible when={!isRedroidRuntime && canChangeContainerArgs}>
        <Setting
          label='Container arguments'
          description='Optional Docker Cmd override. Use a long-running command for images that would otherwise exit immediately, for example sleep infinity.'
          variant='vertical'
          className={verticalSettingClassName}
        >
          <Textarea
            value={values.customContainerArgs}
            placeholder='sleep infinity'
            onChange={event => onChange({ customContainerArgs: event.target.value })}
          />
        </Setting>
      </Visible>
    </Section>
  )
}
