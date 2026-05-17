import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { AppInfoRow } from './app-info-row'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

const formatResources = (app: AppDefinition) => {
  return `RAM ${app.memoryLimitMb ? `${app.memoryLimitMb} MB` : 'unlimited'}, CPU ${
    app.cpuLimitCpus ?? 'unlimited'
  }, volume ${app.volumeSizeLimitMb ? `${app.volumeSizeLimitMb} MB advisory` : 'unlimited'}`
}

export const AppInfoRuntimeSection = ({ app }: { app?: AppDefinition }) => {
  return (
    <Section
      title='Runtime'
      boxed
      titleClassName='pb-4'
      contentClassName='flex-col'
    >
      <AppInfoRow
        label='Container name'
        value={app?.containerName || 'Loading...'}
        copyValue={app?.containerName}
      />
      <AppInfoRow
        label='Container ID'
        value={app?.containerId || 'Not created'}
        copyValue={app?.containerId || undefined}
      />
      <AppInfoRow
        label='Image'
        value={app?.containerImage || 'Loading...'}
        copyValue={app?.containerImage}
      />
      <AppInfoRow
        label='Volume'
        value={app ? (app.profileMode === 'temporary' ? 'Temporary container data' : app.volumeName) : 'Loading...'}
        copyValue={app?.profileMode === 'temporary' ? undefined : app?.volumeName}
      />
      <AppInfoRow
        label='Profile'
        value={app ? `${app.profileName ?? 'default'} / ${app.profileMode}` : 'Loading...'}
      />
      <AppInfoRow
        label='Resources'
        value={app ? formatResources(app) : 'Loading...'}
      />
      <Visible when={app?.containerArgs}>
        <AppInfoRow
          label='Container args'
          value={app?.containerArgs ?? ''}
          copyValue={app?.containerArgs ?? undefined}
        />
      </Visible>
      <AppInfoRow
        label='Idle timeout'
        value={app ? `${app.inactivityTimeoutSeconds}s` : 'Loading...'}
      />
    </Section>
  )
}
