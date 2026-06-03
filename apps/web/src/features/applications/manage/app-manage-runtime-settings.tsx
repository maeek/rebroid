import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberSliderField } from '@/components/ui/number-slider-field'
import { Section } from '@/components/ui/section'
import { Textarea } from '@/components/ui/textarea'
import { Visible } from '@/components/ui/visible'
import { Setting } from '@/features/settings/components/setting'
import { cn } from '@/lib/utils'
import type { AppFormValues } from '@/features/applications/create/create-app-form.types'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ResourceLimitBounds } from '@/server/orchestrator/diagnostics/resource-limits'

type AppManageRuntimeSettingsProps = {
  app?: AppDefinition
  values: AppFormValues
  resourceLimits: ResourceLimitBounds | null
  onChange: (patch: Partial<AppFormValues>) => void
  canChangeSessionLimit: boolean
  canChangeResources: boolean
  canChangeContainerArgs: boolean
  canViewBackendDetails: boolean
}

const verticalSettingClassName = 'flex-col items-start w-full'

export const AppManageRuntimeSettings = ({
  app,
  values,
  resourceLimits,
  onChange,
  canChangeSessionLimit,
  canChangeResources,
  canChangeContainerArgs,
  canViewBackendDetails
}: AppManageRuntimeSettingsProps) => {
  const [showAdvanced, setShowAdvanced] = useState(false)

  return (
    <Section
      title='Runtime'
      boxed
      titleClassName='pb-4'
      contentClassName='gap-5'
    >
      <Visible when={canChangeSessionLimit}>
        <Setting
          label='Inactivity timeout'
          description='How long the app can stay idle before it stops automatically. Use -1 for no automatic stop.'
          variant='vertical'
          className={verticalSettingClassName}
        >
          <Input
            value={values.inactivityTimeoutSeconds}
            min={-1}
            max={86400}
            type='number'
            onChange={event => onChange({ inactivityTimeoutSeconds: Number(event.target.value) })}
          />
        </Setting>
      </Visible>
      <Visible when={canChangeResources}>
        <div className='grid gap-4 md:grid-cols-2'>
          <Setting
            label='RAM limit'
            description='Optional memory limit in MB. Leave empty to use the runtime default.'
            variant='vertical'
            className={verticalSettingClassName}
          >
            <NumberSliderField
              value={values.memoryLimitMb}
              min={128}
              max={resourceLimits?.maxMemoryMb}
              placeholder='MB'
              suffix=' MB'
              rangeLabel='RAM limit range'
              allowEmpty
              onValueChange={value => onChange({ memoryLimitMb: value })}
            />
          </Setting>
          <Setting
            label='CPU limit'
            description='Optional CPU quota in cores. Fractional values like 0.5 are allowed.'
            variant='vertical'
            className={verticalSettingClassName}
          >
            <NumberSliderField
              value={values.cpuLimitCpus}
              min={0.1}
              max={resourceLimits?.maxCpuCpus}
              step={0.1}
              placeholder='cores'
              suffix=' cores'
              rangeLabel='CPU limit range'
              allowEmpty
              onValueChange={value => onChange({ cpuLimitCpus: value })}
            />
          </Setting>
        </div>
      </Visible>
      <Visible when={canViewBackendDetails || canChangeContainerArgs}>
        <div className='flex flex-col gap-2 border-t border-border/60 pt-4'>
          <div
            className={cn(
              'grid overflow-hidden transition-[grid-template-rows,opacity,padding-top,padding-bottom] duration-200 ease-out',
              {
                'grid-rows-[1fr] opacity-100': showAdvanced,
                'grid-rows-[0fr] opacity-0 pt-0 pb-0': !showAdvanced
              }
            )}
          >
            <div className='min-h-0 grid gap-4'>
              <Visible when={canViewBackendDetails}>
                <Setting
                  label='Image'
                  className={verticalSettingClassName}
                  variant='vertical'
                >
                  <Input
                    value={app?.containerImage ?? ''}
                    readOnly
                  />
                </Setting>
              </Visible>
              <Visible when={canChangeContainerArgs}>
                <Setting
                  label='Container arguments'
                  description='Optional Docker Cmd override. Use a long-running command for images that would otherwise exit immediately, for example sleep infinity.'
                  className={verticalSettingClassName}
                  variant='vertical'
                >
                  <Textarea
                    value={values.customContainerArgs}
                    placeholder='sleep infinity'
                    onChange={event => onChange({ customContainerArgs: event.target.value })}
                  />
                </Setting>
              </Visible>
            </div>
          </div>
          <Button
            type='button'
            variant='ghost'
            className='w-full'
            onClick={() => setShowAdvanced(current => !current)}
          >
            {showAdvanced ? 'Hide advanced settings' : 'Show advanced settings'}
          </Button>
        </div>
      </Visible>
    </Section>
  )
}
