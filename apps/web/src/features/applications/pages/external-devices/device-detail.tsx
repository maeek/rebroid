import type { ReactNode } from 'react'
import { IconActivity, IconHome, IconPlugConnected, IconRobot, IconSparkles, IconTerminal2 } from '@tabler/icons-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { ExternalWorkflowRun } from '@/features/applications/pages/external-viewer/external-workflow-run'
import { AppWorkflowsSection } from '@/features/applications/viewer/tools/runtime-tools-panel/workflows/app-workflows-section'
import { loadApplicationActivity } from '@/server/audit/application-activity-query'
import { orchestratorAutomationsClient } from '@/server/orchestrator/automations/client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { externalDeviceClient } from '@/server/orchestrator/external-devices/client'
import { loadFeatureFlags } from '@/server/orchestrator/features'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { getWebSettings } from '@/server/web-settings/store'
import {
  externalDeviceHref,
  externalDeviceStatusLabel,
  externalDeviceViewerHref,
  externalDeviceViews
} from '@/shared/model/applications/external-device-links'
import { hasPermission } from '@/shared/permissions/permissions'
import { DateTimeValue } from '@/shared/ui/date-time-value'
import { DetailFields } from '@/shared/ui/detail-fields'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { ResourceNavigation } from '@/shared/ui/resource-navigation'
import { AvailabilityNotice } from './availability-notice'
import {
  ExternalDetailConnection,
  ExternalDeviceAgent,
  ExternalDeviceDiagnostics,
  RememberExternalDevice
} from './device-detail-tools'
import type { AuditSearchParams } from '@/shared/contracts/audit'
import type { ExternalDevice } from '@/shared/contracts/external-device'
import type { FeatureFlagKey } from '@/shared/contracts/feature-flags'
import type { ExternalDeviceView } from '@/shared/model/applications/external-device-links'

const icons = {
  overview: IconHome,
  connection: IconPlugConnected,
  activity: IconActivity,
  diagnostics: IconTerminal2,
  workflows: IconRobot,
  'ai-agent': IconSparkles
}

function DeviceDetails({ device }: { device?: ExternalDevice }) {
  return (
    <Section
      surface='panel'
      title='Device details'
    >
      <DetailFields
        loading={!device}
        fields={[
          { label: 'Connection type', value: device?.transport === 'usb' ? 'USB' : 'ADB over TCP' },
          { label: 'Connection status', value: device && externalDeviceStatusLabel[device.connection.state] },
          {
            label: 'Last checked',
            value: device?.connection.observedAt ? (
              <DateTimeValue value={device.connection.observedAt} />
            ) : (
              'Awaiting first connection'
            )
          },
          { label: 'Registered', value: device && <DateTimeValue value={device.createdAt} /> }
        ]}
      />
    </Section>
  )
}

function DeviceDetailShell({
  id,
  title,
  views,
  view,
  children,
  description,
  actions,
  loading = false
}: {
  id?: string
  title: string
  views: ExternalDeviceView[]
  view?: ExternalDeviceView
  children: ReactNode
  description?: string
  actions?: ReactNode
  loading?: boolean
}) {
  return (
    <StandardPage>
      <PageHeader
        title={title}
        section={{ label: 'Devices', href: '/devices' }}
        description={description}
        actions={actions}
      />
      <PageContent>
        <ResourceNavigation
          label='Device sections'
          items={views.map(item => {
            const Icon = icons[item]
            return {
              id: item,
              label: externalDeviceViews[item],
              href: id && !loading ? externalDeviceHref(id, item) : undefined,
              current: view === item,
              icon: <Icon className='size-4' />
            }
          })}
        />
        {children}
      </PageContent>
    </StandardPage>
  )
}

const loadingPanelTitles = {
  connection: 'ADB connection',
  activity: 'Activity',
  diagnostics: 'Android logs',
  workflows: 'Workflows',
  'ai-agent': 'AI device agent'
} as const

export function ExternalDeviceDetailLoading({ search }: { search?: AuditSearchParams } = {}) {
  const requested = Array.isArray(search?.view) ? search.view[0] : search?.view
  const view =
    requested && Object.hasOwn(externalDeviceViews, requested) ? (requested as ExternalDeviceView) : undefined
  const views: ExternalDeviceView[] = ['overview', 'connection']
  if (view && !views.includes(view)) views.push(view)
  return (
    <DeviceDetailShell
      title='External device'
      views={views}
      view={view}
      loading
    >
      {view === 'overview' ? (
        <DeviceDetails />
      ) : (
        <Section
          surface='panel'
          title={view ? loadingPanelTitles[view] : undefined}
        >
          <Skeleton className='h-4 w-full max-w-sm' />
          <Skeleton className='h-9 w-36' />
        </Section>
      )}
    </DeviceDetailShell>
  )
}

export const ExternalDeviceDetailRouteLoading = () => <ExternalDeviceDetailLoading />

export async function ExternalDeviceDetail({
  id,
  search,
  renderActivity
}: {
  id: string
  search: AuditSearchParams
  renderActivity: (
    activity: Awaited<ReturnType<typeof loadApplicationActivity>> & {
      application: { id: string; name: string; href: string }
    }
  ) => ReactNode
}) {
  if (!z.uuid().safeParse(id).success) notFound()
  const user = await getCurrentUserContext()
  const device = await externalDeviceClient
    .get(id, { userId: user.ownerUserId, administrator: user.isPlatformAdmin })
    .catch(error => {
      if (error instanceof OrchestratorRequestError && error.status === 404) notFound()
      throw error
    })
  const owned = device.ownerUserId === user.ownerUserId
  if (device.transport === 'usb' && !owned) notFound()
  const canUse = owned && hasPermission(user.permissions, 'devices:use-external')
  const canEnroll = owned && hasPermission(user.permissions, 'devices:enroll-external')
  const canRun = canUse && hasPermission(user.permissions, 'automations:run')
  const manifest = await loadFeatureFlags()
  const enabled = (key: FeatureFlagKey) => manifest?.features.some(flag => flag.key === key && flag.effective) === true
  const workflowsEnabled = canRun && enabled('feature.workflows')
  const views: ExternalDeviceView[] = ['overview', 'connection']
  if (user.isPlatformAdmin) views.push('activity')
  if (canUse && hasPermission(user.permissions, 'applications:view-logs')) views.push('diagnostics')
  if (workflowsEnabled) views.push('workflows')
  if (
    canRun &&
    enabled('feature.ai') &&
    hasPermission(user.permissions, 'automations:run-ai') &&
    hasPermission(user.permissions, 'applications:capture-screenshot')
  )
    views.push('ai-agent')
  const requested = Array.isArray(search.view) ? search.view[0] : search.view
  const view = views.find(candidate => candidate === requested) ?? 'overview'
  const attachment =
    enabled('feature.external-devices') && device.connection.state === 'ready' ? device.connection.attachmentId : null
  const connectionHref = externalDeviceHref(id, 'connection')
  const requiresConnection = (
    <Notice
      title='Verified connection required'
      actions={
        <Button
          asChild
          variant='outline'
        >
          <Link href={connectionHref}>Open Connection</Link>
        </Button>
      }
    >
      Connect and verify this device to use this tool.
    </Notice>
  )

  let content: ReactNode = <DeviceDetails device={device} />
  if (view === 'connection') {
    const availability = await externalDeviceClient
      .availability()
      .catch(() => ({ enabled: false, status: 'broker_unavailable' }) as const)
    content = (
      <>
        {availability.status === 'available' ? null : (
          <AvailabilityNotice
            status={availability.status}
            administrator={user.isPlatformAdmin}
          />
        )}
        <ExternalDetailConnection
          initial={device}
          enabled={availability.enabled}
          canEnroll={canEnroll}
          canUse={canUse}
        />
      </>
    )
  }
  if (view === 'activity') {
    const activity = await loadApplicationActivity(id, search)
    content = renderActivity({ ...activity, application: { id, name: device.name, href: externalDeviceHref(id) } })
  }
  if (view === 'diagnostics') {
    content = attachment ? (
      <ExternalDeviceDiagnostics
        key={attachment}
        device={device}
        attachmentId={attachment}
      />
    ) : (
      requiresConnection
    )
  }
  if (view === 'workflows') {
    const workflows = attachment
      ? await orchestratorAutomationsClient.listRunnableOptions(user.ownerUserId).catch(() => [])
      : []
    content = (
      <>
        {attachment ? (
          workflows.length ? (
            <ExternalWorkflowRun
              key={attachment}
              deviceId={id}
              attachmentId={attachment}
              workflows={workflows}
            />
          ) : (
            <Notice>Create a saved workflow to run it on this device.</Notice>
          )
        ) : (
          requiresConnection
        )}
        <AppWorkflowsSection
          appId={id}
          launch={null}
        />
      </>
    )
  }
  if (view === 'ai-agent') {
    content = attachment ? (
      <ExternalDeviceAgent
        key={attachment}
        device={device}
        attachmentId={attachment}
        canSaveWorkflow={workflowsEnabled && hasPermission(user.permissions, 'automations:manage')}
        contextualSuggestionsEnabled={(await getWebSettings()).aiContextualSuggestionsEnabled}
      />
    ) : (
      requiresConnection
    )
  }

  return (
    <DeviceDetailShell
      id={id}
      title={device.name}
      views={views}
      view={view}
      description={device.transport === 'usb' ? 'External USB device' : 'External TCP device'}
      actions={
        canUse && view !== 'connection' ? (
          <Button asChild>
            <Link
              prefetch={false}
              href={attachment ? externalDeviceViewerHref(id, attachment) : connectionHref}
            >
              {attachment ? 'Open viewer' : 'Open Connection'}
            </Link>
          </Button>
        ) : undefined
      }
    >
      {canUse || canEnroll || user.isPlatformAdmin ? <RememberExternalDevice id={id} /> : null}
      {requested && requested !== view ? (
        <Notice>This view is unavailable for this device. Showing Overview.</Notice>
      ) : null}
      {content}
    </DeviceDetailShell>
  )
}
