import type { CreateAppFormValues } from './create-app-form.types'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Visible } from '@/components/ui/visible'
import { Setting } from '@/features/settings/components/setting'
import { redroidDefaultsLabel, redroidDisplayArgsForProfile, redroidDisplayProfiles } from '@/shared/runtime/redroid-runtime'

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
      <Visible when={isRedroidRuntime}>
        <Setting
          label='Display profile'
          description='Boot-time Redroid resolution, density, and frame-rate. Changing it later requires recreating the runtime container.'
          variant='vertical'
          className={verticalSettingClassName}
        >
          <Select
            value={values.redroidDisplayProfileId}
            onValueChange={value => onChange({ redroidDisplayProfileId: value })}
          >
            <SelectTrigger className='h-11 w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {redroidDisplayProfiles.map(profile => (
                <SelectItem
                  key={profile.id}
                  value={profile.id}
                >
                  <span className='flex min-w-0 flex-col'>
                    <span>{profile.label}</span>
                    <span className='text-xs text-muted-foreground'>{profile.description}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Setting>
        <Setting
          label='Redroid base arguments'
          description='Applied automatically for Redroid images. The managed ADB endpoint uses TCP port 5555. Extra arguments below can override these by using the same key.'
          variant='vertical'
          className={verticalSettingClassName}
        >
          <div className='rounded-md border border-border/60 bg-background/40 px-3 py-2 font-mono text-xs text-secondary-foreground'>
            {redroidDefaultsLabel} {redroidDisplayArgsForProfile(values.redroidDisplayProfileId)}
          </div>
        </Setting>
      </Visible>
      <Visible when={isRedroidRuntime && canChangeContainerArgs}>
        <Setting
          label='Extra Redroid arguments'
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
