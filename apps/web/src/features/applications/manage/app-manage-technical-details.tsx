import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { AppInfoRow } from '@/features/applications/viewer/app-info/app-info-row'
import { formatDateLocale } from '@/lib/format'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

const formatResources = (app: AppDefinition) => {
  const memory = app.memoryLimitMb ? `${app.memoryLimitMb} MB` : 'unlimited'
  const cpu = app.cpuLimitCpus ?? 'unlimited'
  return `RAM ${memory}, CPU ${cpu}`
}

const formatProfile = (app: AppDefinition) => `${app.profileName ?? 'default'} / ${app.profileMode}`

const formatVolume = (app: AppDefinition) =>
  app.profileMode === 'temporary' ? 'Temporary container data' : app.volumeName

const formatPolicyStatus = (app: AppDefinition) =>
  app.networkPolicyResult?.status ?? app.networkPolicyStatus ?? 'not applied'

export const AppManageTechnicalDetails = ({ app }: { app: AppDefinition }) => {
  const adbAddress = `${app.containerName}:${app.adbPort}`
  const policyMessage = app.networkPolicyResult?.hint ?? app.networkPolicyResult?.message ?? app.networkPolicyMessage
  const applicationError = app.applicationError

  return (
    <Section
      title='Details'
      boxed
      collapsible
      titleClassName='pb-4'
      contentClassName='flex-col'
    >
      <AppInfoRow
        label='App ID'
        value={app.id}
        copyValue={app.id}
      />
      <AppInfoRow
        label='APK'
        value={app.apkOriginalName ?? 'No APK uploaded'}
        copyValue={app.apkOriginalName ?? undefined}
      />
      <Visible when={app.lastError}>
        <AppInfoRow
          label='Last error'
          value={app.lastError}
          copyValue={app.lastError ?? undefined}
        />
      </Visible>
      <Visible when={applicationError}>
        <AppInfoRow
          label='Error code'
          value={`${applicationError?.code} (${applicationError?.phase})`}
          copyValue={applicationError ? `${applicationError.code}:${applicationError.phase}` : undefined}
        />
      </Visible>
      <Visible when={applicationError?.hint}>
        <AppInfoRow
          label='Error hint'
          value={applicationError?.hint ?? ''}
          copyValue={applicationError?.hint ?? undefined}
        />
      </Visible>
      <AppInfoRow
        label='Profile'
        value={formatProfile(app)}
      />
      <AppInfoRow
        label='Resources'
        value={formatResources(app)}
      />
      <AppInfoRow
        label='Idle timeout'
        value={`${app.inactivityTimeoutSeconds}s`}
      />
      <AppInfoRow
        label='Container name'
        value={app.containerName}
        copyValue={app.containerName}
      />
      <AppInfoRow
        label='Container ID'
        value={app.containerId ?? 'Not created'}
        copyValue={app.containerId ?? undefined}
      />
      <AppInfoRow
        label='Image'
        value={app.containerImage}
        copyValue={app.containerImage}
      />
      <AppInfoRow
        label='Volume'
        value={formatVolume(app)}
        copyValue={app.profileMode === 'temporary' ? undefined : app.volumeName}
      />
      <Visible when={app.containerArgs}>
        <AppInfoRow
          label='Container args'
          value={app.containerArgs}
          copyValue={app.containerArgs ?? undefined}
        />
      </Visible>
      <AppInfoRow
        label='Network'
        value={app.networkName}
        copyValue={app.networkName}
      />
      <AppInfoRow
        label='Network policy'
        value={formatPolicyStatus(app)}
      />
      <Visible when={app.networkPolicyAppliedAt}>
        <AppInfoRow
          label='Policy applied'
          value={formatDateLocale(app.networkPolicyAppliedAt as Date)}
        />
      </Visible>
      <Visible when={policyMessage}>
        <AppInfoRow
          label='Policy message'
          value={policyMessage}
        />
      </Visible>
      <AppInfoRow
        label='ADB'
        value={adbAddress}
        copyValue={adbAddress}
      />
      <AppInfoRow
        label='Transport'
        value={app.scrcpyTransport}
      />
      <AppInfoRow
        label='Updated'
        value={formatDateLocale(app.updatedAt)}
      />
    </Section>
  )
}
