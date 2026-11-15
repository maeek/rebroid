'use client'

import { useContext } from 'react'
import { getRedroidDisplayDimensionsFromArgs } from '@rebroid/android-application-core/redroid-runtime'
import { FormLoadingContext } from '@/components/ui/form-loading-boundary'
import { Section } from '@/components/ui/section'
import { AppContainerRuntimeSection } from '@/features/applications/components/app-container-runtime-section'
import { AppDisplayPreview } from '@/features/applications/components/app-display-preview'
import { AppLifecycleFields } from '@/features/applications/components/app-lifecycle-fields'
import { cn } from '@/lib/utils'
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
  const loading = useContext(FormLoadingContext)
  const showContainerSettings = canViewBackendDetails || canChangeContainerArgs
  const isRedroid = app?.runtimeKind === 'redroid'
  const showDisplay = isRedroid || loading
  const showRuntimeColumns = canViewBackendDetails && showDisplay
  const displayArgs = canChangeContainerArgs ? values.customContainerArgs : app?.containerArgs
  const display = isRedroid ? getRedroidDisplayDimensionsFromArgs(displayArgs) : null

  return (
    <>
      {showContainerSettings ? (
        <Section
          title='Runtime settings'
          surface='plain'
          className='@container/runtime'
        >
          <AppContainerRuntimeSection
            contentClassName={cn(
              'gap-4',
              showRuntimeColumns &&
                'grid items-start @min-[36rem]/runtime:grid-cols-2 @min-[36rem]/runtime:gap-x-form-column'
            )}
            containerImage={app?.containerImage ?? ''}
            showContainerImage={canViewBackendDetails}
            containerImageMode='readonly'
            containerImageLabel='Runtime image'
            showContainerArgs={canChangeContainerArgs}
            collapsibleArgs
            containerArgsLabel='Command-line arguments'
            containerArgsValue={values.customContainerArgs}
            containerArgsModified={Boolean(app && values.customContainerArgs !== (app.containerArgs ?? ''))}
            onContainerArgsChange={value => onChange({ customContainerArgs: value })}
            containerArgsDescription={
              isRedroid || loading
                ? 'Set Android GPU rendering in Administration → General.'
                : 'Optional Docker command override. Use a long-running command if the image would otherwise exit.'
            }
            containerArgsPlaceholder={isRedroid || loading ? 'androidboot.redroid_fps=30' : 'sleep infinity'}
          >
            {showDisplay ? (
              <AppDisplayPreview
                display={display}
                title='Configured display'
                layout='stacked'
              />
            ) : null}
          </AppContainerRuntimeSection>
        </Section>
      ) : null}
      {canChangeSessionLimit || canChangeResources ? (
        <Section
          title={showContainerSettings ? 'Lifecycle and resources' : 'Runtime settings'}
          surface='plain'
        >
          <AppLifecycleFields
            showSession={canChangeSessionLimit}
            showResources={canChangeResources}
            values={values}
            resourceLimits={resourceLimits}
            onChange={onChange}
            modified={{
              inactivityTimeoutSeconds: Boolean(
                app && values.inactivityTimeoutSeconds !== app.inactivityTimeoutSeconds
              ),
              memoryLimitMb: Boolean(app && values.memoryLimitMb !== (app.memoryLimitMb?.toString() ?? '')),
              cpuLimitCpus: Boolean(app && values.cpuLimitCpus !== (app.cpuLimitCpus?.toString() ?? ''))
            }}
          />
        </Section>
      ) : null}
    </>
  )
}
