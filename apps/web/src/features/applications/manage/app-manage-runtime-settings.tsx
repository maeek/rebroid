import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Textarea } from '@/components/ui/textarea'
import { Visible } from '@/components/ui/visible'
import { AppFormResourcesSection } from '@/features/applications/create/create-app-resources-section'
import { AppFormSessionSection } from '@/features/applications/create/create-app-session-section'
import { Setting } from '@/features/settings/components/setting'
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
  return (
    <>
      <Visible when={canChangeSessionLimit}>
        <AppFormSessionSection
          values={values}
          onChange={onChange}
        />
      </Visible>
      <Visible when={canChangeResources}>
        <AppFormResourcesSection
          values={values}
          resourceLimits={resourceLimits}
          onChange={onChange}
        />
      </Visible>
      <Section
        title='Runtime'
        boxed
        titleClassName='pb-4'
        contentClassName='gap-6'
      >
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
      </Section>
    </>
  )
}
