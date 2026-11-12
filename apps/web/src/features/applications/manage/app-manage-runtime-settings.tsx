'use client'

import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { AppContainerRuntimeSection } from '@/features/applications/components/app-container-runtime-section'
import { AppResourceLimitsSection } from '@/features/applications/components/app-resource-limits-section'
import { AppRuntimeSection } from '@/features/applications/components/app-runtime-section'
import type { AppFormValues } from '@/features/applications/create/create-app-form.types'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ResourceLimitBounds } from '@/shared/contracts/system-resources'

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
  const showContainerImage = canViewBackendDetails
  const showContainerArgs = canChangeContainerArgs

  return (
    <Section
      title='Runtime settings'
      surface='band'
      headingSpacing='default'
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
          containerArgsDescription={
            app?.runtimeKind === 'redroid'
              ? 'Set Android GPU rendering in Administration → General.'
              : 'Optional Docker Cmd override. Use a long-running command for images that would otherwise exit immediately, for example sleep infinity.'
          }
          containerArgsPlaceholder='sleep infinity'
        />
      </Visible>
    </Section>
  )
}
