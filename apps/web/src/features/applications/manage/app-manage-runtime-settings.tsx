'use client'

import { useContext } from 'react'
import { getRedroidDisplayDimensionsFromArgs } from '@rebroid/android-application-core/redroid-runtime'
import { FormLoadingContext } from '@/components/ui/form-loading-boundary'
import { Section } from '@/components/ui/section'
import { AppContainerRuntimeSection } from '@/features/applications/components/app-container-runtime-section'
import { AppLifecycleFields } from '@/features/applications/components/app-lifecycle-fields'
import { cn } from '@/lib/utils'
import { DetailFields } from '@/shared/ui/detail-fields'
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
  disabled?: boolean
}

export const AppManageRuntimeSettings = ({
  app,
  values,
  resourceLimits,
  onChange,
  canChangeSessionLimit,
  canChangeResources,
  canChangeContainerArgs,
  canViewBackendDetails,
  disabled
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
                'grid items-start @min-[28rem]/runtime:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] @min-[28rem]/runtime:gap-x-form-column @min-[28rem]/runtime:gap-y-2'
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
              <DetailFields
                loading={loading}
                compact
                fields={[
                  {
                    label: 'Configured display',
                    value: display ? (
                      <span className='tabular-nums'>
                        {display.width} × {display.height} px{display.dpi === undefined ? '' : ` · ${display.dpi} dpi`}
                      </span>
                    ) : null,
                    fullWidth: true
                  }
                ]}
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
            disabled={disabled}
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
