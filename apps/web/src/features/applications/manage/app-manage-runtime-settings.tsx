'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { AppContainerRuntimeSection } from '@/features/applications/components/app-container-runtime-section'
import { AppResourceLimitsSection } from '@/features/applications/components/app-resource-limits-section'
import { AppRuntimeSection } from '@/features/applications/components/app-runtime-section'
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

  const showContainerImage = canViewBackendDetails
  const showContainerArgs = canChangeContainerArgs && showAdvanced

  return (
    <Section
      title='Runtime'
      surface='band'
      titleClassName='pb-4'
      contentClassName='gap-5'
    >
      <Visible when={canChangeSessionLimit}>
        <AppRuntimeSection
          values={values}
          onChange={onChange}
        />
      </Visible>
      <Visible when={canChangeResources}>
        <AppResourceLimitsSection
          values={values}
          resourceLimits={resourceLimits}
          onChange={onChange}
          descriptionForMemory='Optional memory limit in MB. Leave empty to use the runtime default.'
        />
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
            <Visible when={showContainerImage || showContainerArgs}>
              <div className='min-h-0 grid gap-4'>
                <AppContainerRuntimeSection
                  containerImage={app?.containerImage ?? ''}
                  showContainerImage={showContainerImage}
                  containerImageMode='readonly'
                  containerImageLabel='Image'
                  containerImageDescription='The managed container image for this app runtime.'
                  showContainerArgs={showContainerArgs}
                  containerArgsValue={values.customContainerArgs}
                  containerArgsMode='editable'
                  onContainerArgsChange={value => onChange({ customContainerArgs: value })}
                  containerArgsLabel='Container arguments'
                  containerArgsDescription='Optional Docker Cmd override. Use a long-running command for images that would otherwise exit immediately, for example sleep infinity.'
                  containerArgsPlaceholder='sleep infinity'
                />
              </div>
            </Visible>
          </div>
          <Button
            type='button'
            variant='outline'
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
