import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { AppInfoRow } from './app-info-row'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

const formatMemoryLimit = (app: AppDefinition) => (app.memoryLimitMb ? `${app.memoryLimitMb} MB` : 'unlimited')

const formatCpuLimit = (app: AppDefinition) => app.cpuLimitCpus ?? 'unlimited'

const formatResources = (app: AppDefinition) => {
  return `RAM ${formatMemoryLimit(app)}, CPU ${formatCpuLimit(app)}`
}

const getContainerName = (app?: AppDefinition) => app?.containerName ?? 'Loading...'

const getContainerNameCopyValue = (app?: AppDefinition) => app?.containerName

const getContainerId = (app?: AppDefinition) => app?.containerId ?? 'Not created'

const getContainerIdCopyValue = (app?: AppDefinition) => app?.containerId ?? undefined

const getContainerImage = (app?: AppDefinition) => app?.containerImage ?? 'Loading...'

const getContainerImageCopyValue = (app?: AppDefinition) => app?.containerImage

const getVolumeValue = (app?: AppDefinition) => {
  if (!app) {
    return 'Loading...'
  }

  return app.profileMode === 'temporary' ? 'Temporary container data' : app.volumeName
}

const getVolumeCopyValue = (app?: AppDefinition) => {
  if (!app || app.profileMode === 'temporary') {
    return undefined
  }

  return app.volumeName
}

const getProfileValue = (app?: AppDefinition) => {
  if (!app) {
    return 'Loading...'
  }

  return `${app.profileName ?? 'default'} / ${app.profileMode}`
}

const getResourcesValue = (app?: AppDefinition) => {
  if (!app) {
    return 'Loading...'
  }

  return formatResources(app)
}

const getContainerArgs = (app?: AppDefinition) => app?.containerArgs ?? undefined

const getIdleTimeoutValue = (app?: AppDefinition) => {
  if (!app) {
    return 'Loading...'
  }

  return `${app.inactivityTimeoutSeconds}s`
}

const RuntimeBackendRows = ({ app }: { app?: AppDefinition }) => (
  <>
    <AppInfoRow
      label='Container name'
      value={getContainerName(app)}
      copyValue={getContainerNameCopyValue(app)}
    />
    <AppInfoRow
      label='Container ID'
      value={getContainerId(app)}
      copyValue={getContainerIdCopyValue(app)}
    />
    <AppInfoRow
      label='Image'
      value={getContainerImage(app)}
      copyValue={getContainerImageCopyValue(app)}
    />
    <AppInfoRow
      label='Volume'
      value={getVolumeValue(app)}
      copyValue={getVolumeCopyValue(app)}
    />
  </>
)

const ContainerArgsRow = ({ containerArgs }: { containerArgs?: string }) => (
  <Visible when={containerArgs}>
    <AppInfoRow
      label='Container args'
      value={containerArgs}
      copyValue={containerArgs}
    />
  </Visible>
)

export const AppInfoRuntimeSection = ({
  app,
  canViewBackendDetails
}: {
  app?: AppDefinition
  canViewBackendDetails: boolean
}) => {
  return (
    <Section
      surface='plain'
      title='Runtime'
      headingSpacing='default'
      contentClassName='flex-col'
    >
      <Visible when={canViewBackendDetails}>
        <RuntimeBackendRows app={app} />
      </Visible>
      <AppInfoRow
        label='Profile'
        value={getProfileValue(app)}
      />
      <AppInfoRow
        label='Resources'
        value={getResourcesValue(app)}
      />
      <Visible when={canViewBackendDetails && app?.containerArgs}>
        <ContainerArgsRow containerArgs={getContainerArgs(app)} />
      </Visible>
      <AppInfoRow
        label='Idle timeout'
        value={getIdleTimeoutValue(app)}
      />
    </Section>
  )
}
