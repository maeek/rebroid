import { Section } from '@/components/ui/section'
import { editorSectionClassName } from '@/components/ui/surface'
import { formatDateLocale } from '@/lib/format'
import { DetailFields, type DetailField } from '@/shared/ui/detail-fields'
import { ResourceLink } from '@/shared/ui/resource-link'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

export interface InspectedContainerCommand {
  containerId: string
  command: string
}

export const AppManageTechnicalDetails = ({
  app,
  canViewInfrastructure = false,
  inspectedCommand,
  loading = false
}: {
  app?: AppDefinition
  canViewInfrastructure?: boolean
  inspectedCommand?: InspectedContainerCommand | null
  loading?: boolean
}) => {
  const resourceValue = (value: string | undefined, href: string) =>
    canViewInfrastructure && value ? <ResourceLink href={href}>{value}</ResourceLink> : value
  const containerValue = (value: string | undefined) =>
    app?.containerId ? resourceValue(value, `/runtime/containers/${encodeURIComponent(app?.containerId)}`) : value
  const policyMessage = app?.networkPolicyResult?.hint ?? app?.networkPolicyResult?.message
  const adbAddress = `${app?.containerName}:${app?.adbPort}`
  const containerFields: DetailField[] = [
    {
      label: 'Container name',
      value: containerValue(app?.containerName),
      copyValue: app?.containerName,
      code: true,
      fullWidth: true
    },
    {
      label: 'Container ID',
      value: app?.containerId ? containerValue(app?.containerId) : 'Not created',
      copyValue: app?.containerId ?? undefined,
      code: true,
      fullWidth: true
    },
    {
      label: 'Image',
      value: resourceValue(app?.containerImage, `/runtime/images/${encodeURIComponent(app?.containerImage ?? '')}`),
      copyValue: app?.containerImage,
      code: true,
      fullWidth: true
    },
    {
      label: 'Volume',
      value: app?.profileMode === 'temporary' ? 'Temporary container data' : app?.volumeName,
      copyValue: app?.profileMode === 'temporary' ? undefined : (app?.volumeName ?? undefined),
      code: true,
      fullWidth: true
    }
  ]
  const command = inspectedCommand?.containerId === app?.containerId ? inspectedCommand?.command : undefined
  if (loading || (canViewInfrastructure && app?.containerId))
    containerFields.push({
      label: 'Container command',
      value: command ?? 'Unavailable',
      copyValue: command,
      code: true,
      fullWidth: true
    })
  const networkFields: DetailField[] = [
    {
      label: 'Network',
      value: resourceValue(app?.networkName, `/runtime/networks/${encodeURIComponent(app?.networkName ?? '')}`),
      copyValue: app?.networkName,
      code: true
    },
    { label: 'Transport', value: app?.scrcpyTransport },
    { label: 'ADB', value: adbAddress, copyValue: adbAddress, code: true, fullWidth: true },
    { label: 'Network policy', value: app?.networkPolicyResult?.status ?? 'Not applied' }
  ]
  if (app?.networkPolicyAppliedAt)
    networkFields.push({ label: 'Policy applied', value: formatDateLocale(app?.networkPolicyAppliedAt) })
  if (policyMessage) networkFields.push({ label: 'Policy message', value: policyMessage, fullWidth: true })

  return (
    <Section
      title='Details'
      surface='plain'
      className={editorSectionClassName}
      headingSpacing='default'
      contentClassName='gap-6'
    >
      <DetailFields
        loading={loading}
        title='Application'
        fields={[
          { label: 'App ID', value: app?.id, copyValue: app?.id, code: true, fullWidth: true },
          {
            label: 'APK',
            value: app?.apkOriginalName ?? 'No APK uploaded',
            copyValue: app?.apkOriginalName ?? undefined
          },
          { label: 'Profile', value: `${app?.profileName ?? 'default'} / ${app?.profileMode}` },
          {
            label: 'Memory limit',
            value: app?.memoryLimitMb === null ? 'Runtime default' : `${app?.memoryLimitMb} MB`
          },
          { label: 'CPU limit', value: app?.cpuLimitCpus === null ? 'Runtime default' : `${app?.cpuLimitCpus} cores` },
          {
            label: 'Idle timeout',
            value: app?.inactivityTimeoutSeconds === -1 ? 'Unlimited' : `${app?.inactivityTimeoutSeconds} seconds`
          },
          { label: 'Updated', value: app?.updatedAt ? formatDateLocale(app.updatedAt) : undefined }
        ]}
      />
      <DetailFields
        loading={loading}
        title='Container'
        fields={containerFields}
      />
      <DetailFields
        loading={loading}
        title='Network'
        fields={networkFields}
      />
    </Section>
  )
}
