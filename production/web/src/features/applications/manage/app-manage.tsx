'use client'

import { useEffect, useRef, useState } from 'react'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Visible } from '@/components/ui/visible'
import { AppNotFoundSplash } from '@/features/applications/components/app-not-found-splash'
import { AppViewerStatusSection } from '@/features/applications/detail/app-viewer-status-section'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { getAppRefreshIntervalMs } from '@/features/applications/domain/refresh'
import { resolveAppIconUrl } from '@/features/applications/icons/url'
import { AppViewerDeleteAction } from '@/features/applications/viewer/actions/app-viewer-delete-action'
import { AppLogsDialog } from '@/features/applications/viewer/app-logs-dialog'
import { AppViewerHeading } from '@/features/applications/viewer/heading'
import { AppInfo } from '@/features/applications/viewer/info'
import { AndroidNotifications } from '@/features/applications/viewer/notifications'
import { useResourceLimitBounds } from '@/features/settings/hooks/use-resource-limit-bounds'
import { PageBreadcrumbs } from '@/features/shell/components/page-breadcrumbs'
import { ProtectedSplitPageContent, ProtectedSplitPageLayout } from '@/features/shell/components/protected-page-shell'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { toast } from '@/hooks/use-toast'
import { updateApplicationAction } from '@/server/orchestrator/applications/mutation-actions'
import { getApplicationAction } from '@/server/orchestrator/applications/read-actions'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import { PageBackdrop } from '../../shell/components/page-backdrop'
import { AppManageGeneralSettings } from './app-manage-general-settings'
import { AppManageIconPanel } from './app-manage-icon-panel'
import { AppManageNetworkPolicySettings } from './app-manage-network-policy-settings'
import { AppManageRuntimeSettings } from './app-manage-runtime-settings'
import type { AppFormValues } from '@/features/applications/create/create-app-form.types'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { OrchestratorUiSettings } from '@/features/settings/hooks/use-orchestrator-ui-settings'

const mergeAppPreservingIcon = (nextApp: AppDefinition, currentApp?: AppDefinition) => ({
  ...nextApp,
  icon: currentApp?.icon ?? nextApp.icon,
  ownerDisplayName: currentApp?.ownerDisplayName ?? nextApp.ownerDisplayName
})

export default function AppManage({
  app,
  permissions,
  initialSettings,
  currentOwnerUserId,
  isAdmin
}: {
  app?: AppDefinition
  permissions: PermissionMap
  initialSettings: OrchestratorUiSettings
  currentOwnerUserId: string
  isAdmin: boolean
}) {
  const [currentApp, setCurrentApp] = useState(app)
  const [appName, setAppName] = useState(app?.name || '')
  const [inactivityTimeoutSeconds, setInactivityTimeoutSeconds] = useState(app?.inactivityTimeoutSeconds ?? 900)
  const [memoryLimitMb, setMemoryLimitMb] = useState(app?.memoryLimitMb?.toString() ?? '')
  const [cpuLimitCpus, setCpuLimitCpus] = useState(app?.cpuLimitCpus?.toString() ?? '')
  const [volumeSizeLimitMb, setVolumeSizeLimitMb] = useState(app?.volumeSizeLimitMb?.toString() ?? '')
  const [containerArgs, setContainerArgs] = useState(app?.containerArgs ?? '')
  const [icon, setIcon] = useState<string | null>(app?.icon ?? null)
  const [isSaving, setIsSaving] = useState(false)
  const hasPendingAppChangesRef = useRef(false)
  const isIconDirtyRef = useRef(false)
  const previousAppIdRef = useRef(app?.id)
  const router = useRouter()
  const currentAppId = currentApp?.id
  const refreshIntervalMs = getAppRefreshIntervalMs(currentApp)
  const canChangeSessionLimit = hasPermission(permissions, 'applications:change-session-limit')
  const canChangeResources = hasPermission(permissions, 'applications:change-resources')
  const canChangeContainerArgs = hasPermission(permissions, 'applications:change-container-args')
  const canConfigureEgress = hasPermission(permissions, 'applications:configure-egress')
  const canViewBackendDetails = hasPermission(permissions, 'applications:view-backend-details')
  const canViewLogs = hasPermission(permissions, 'applications:view-logs')
  const canDelete = hasPermission(permissions, 'applications:delete')
  const isForeignOwnedApp = Boolean(isAdmin && currentApp && currentApp.ownerUserId !== currentOwnerUserId)
  const showRuntimeSection =
    canChangeSessionLimit || canChangeResources || canChangeContainerArgs || canViewBackendDetails
  const resourceLimits = useResourceLimitBounds(canChangeResources)

  useEffect(() => {
    if (app?.id !== previousAppIdRef.current) {
      previousAppIdRef.current = app?.id
      hasPendingAppChangesRef.current = false
      isIconDirtyRef.current = false
    }

    setCurrentApp(current => {
      if (!app) {
        return app
      }

      if (app.id !== current?.id) {
        return app
      }

      return mergeAppPreservingIcon(app, current)
    })
  }, [app])

  useEffect(() => {
    if (!currentApp) {
      return
    }

    if (!hasPendingAppChangesRef.current) {
      setAppName(currentApp.name)
      setInactivityTimeoutSeconds(currentApp.inactivityTimeoutSeconds)
      setMemoryLimitMb(currentApp.memoryLimitMb?.toString() ?? '')
      setCpuLimitCpus(currentApp.cpuLimitCpus?.toString() ?? '')
      setVolumeSizeLimitMb(currentApp.volumeSizeLimitMb?.toString() ?? '')
      setContainerArgs(currentApp.containerArgs ?? '')
    }
  }, [currentApp])

  useEffect(() => {
    if (!currentApp) return

    if (!isIconDirtyRef.current) {
      setIcon(currentApp.icon ?? null)
    }
  }, [currentApp])

  const { data: refreshedApp } = usePollingQuery(
    ['applications', currentAppId],
    () => getApplicationAction(currentAppId!),
    {
      enabled: Boolean(currentAppId),
      intervalMs: refreshIntervalMs
    }
  )

  useEffect(() => {
    if (refreshedApp) {
      setCurrentApp(current => mergeAppPreservingIcon(mapAndroidApplicationToAppDefinition(refreshedApp), current))
    }
  }, [refreshedApp])

  if (!currentApp) {
    return <AppNotFoundSplash />
  }

  const displayApp = { ...currentApp, name: appName, icon }
  const formValues: AppFormValues = {
    name: appName,
    containerImage: currentApp.containerImage,
    inactivityTimeoutSeconds,
    memoryLimitMb,
    cpuLimitCpus,
    volumeSizeLimitMb,
    customContainerArgs: containerArgs,
    redroidDisplayProfileId: 'custom',
    redroidCustomDisplayWidth: '',
    redroidCustomDisplayHeight: '',
    redroidCustomDisplayDpi: '',
    redroidExtraArgs: ''
  }

  const handleFormChange = (patch: Partial<AppFormValues>) => {
    hasPendingAppChangesRef.current = true
    if (patch.name !== undefined) setAppName(patch.name)
    if (patch.inactivityTimeoutSeconds !== undefined) setInactivityTimeoutSeconds(patch.inactivityTimeoutSeconds)
    if (patch.memoryLimitMb !== undefined) setMemoryLimitMb(patch.memoryLimitMb)
    if (patch.cpuLimitCpus !== undefined) setCpuLimitCpus(patch.cpuLimitCpus)
    if (patch.volumeSizeLimitMb !== undefined) setVolumeSizeLimitMb(patch.volumeSizeLimitMb)
    if (patch.customContainerArgs !== undefined) setContainerArgs(patch.customContainerArgs)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const updated = await updateApplicationAction(currentApp.id, {
        name: appName,
        inactivityTimeoutSeconds: canChangeSessionLimit ? inactivityTimeoutSeconds : undefined,
        memoryLimitMb: canChangeResources && memoryLimitMb ? Number(memoryLimitMb) : undefined,
        cpuLimitCpus: canChangeResources && cpuLimitCpus ? Number(cpuLimitCpus) : undefined,
        volumeSizeLimitMb: canChangeResources && volumeSizeLimitMb ? Number(volumeSizeLimitMb) : undefined,
        containerArgs: canChangeContainerArgs ? containerArgs.trim() || null : undefined
      })
      hasPendingAppChangesRef.current = false
      setCurrentApp(current => mergeAppPreservingIcon(mapAndroidApplicationToAppDefinition(updated), current))
      toast({ title: 'App saved' })
      router.refresh()
    } catch (error) {
      toast({
        title: 'Could not save app',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ProtectedSplitPageLayout>
      <PageBackdrop
        imageSrc={displayApp.icon ? resolveAppIconUrl(displayApp.icon) : null}
        opacity={0.08}
      />
      <ProtectedSplitPageContent>
        <PageBreadcrumbs
          items={[
            { label: 'Apps', href: '/apps' },
            { label: appName || currentApp.name, href: `/app/${currentApp.id}` },
            { label: 'Manage' }
          ]}
        />
        <AppViewerHeading app={displayApp}>
          <div className='flex gap-2'>
            <Visible when={canViewLogs && !isForeignOwnedApp}>
              <AppLogsDialog app={currentApp} />
            </Visible>
            <Visible when={canDelete}>
              <AppViewerDeleteAction
                app={displayApp}
                initialSettings={initialSettings}
              />
            </Visible>
            <Button
              disabled={isSaving}
              onClick={() => void handleSave()}
            >
              <IconDeviceFloppy className='size-4' />
              Save
            </Button>
          </div>
        </AppViewerHeading>
        <Visible when={isForeignOwnedApp}>
          <Badge
            variant='outline'
            className='w-fit'
          >
            Owner: {currentApp.ownerDisplayName ?? currentApp.ownerUserId ?? 'Unknown'}
          </Badge>
        </Visible>
        <div className='grid w-full grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)] items-start gap-6 pb-24 max-lg:grid-cols-1'>
          <div className='flex min-w-0 flex-col gap-5'>
            <AppViewerStatusSection app={currentApp} />
            <AppManageGeneralSettings
              app={currentApp}
              appId={currentApp.id}
              values={formValues}
              initialSettings={initialSettings}
              onAppNameChange={value => {
                hasPendingAppChangesRef.current = true
                setAppName(value)
              }}
            />
            <Visible when={showRuntimeSection}>
              <AppManageRuntimeSettings
                app={currentApp}
                values={formValues}
                resourceLimits={resourceLimits}
                canChangeSessionLimit={canChangeSessionLimit}
                canChangeResources={canChangeResources}
                canChangeContainerArgs={canChangeContainerArgs}
                canViewBackendDetails={canViewBackendDetails}
                onChange={handleFormChange}
              />
            </Visible>
            <Visible when={canConfigureEgress}>
              <AppManageNetworkPolicySettings
                app={currentApp}
                onUpdated={setCurrentApp}
              />
            </Visible>
          </div>
          <div className='flex w-full min-w-0 flex-col gap-4'>
            <AppManageIconPanel
              appId={currentApp.id}
              appName={appName}
              icon={icon}
              initialSettings={initialSettings}
              onIconChange={(nextIcon, isDirty) => {
                isIconDirtyRef.current = isDirty
                setIcon(nextIcon)
              }}
            />
            <div className='flex flex-col gap-4'>
              <h2 className='font-bold'>Details</h2>
              <AndroidNotifications app={currentApp} />
              <AppInfo
                app={currentApp}
                permissions={permissions}
                onAppChange={setCurrentApp}
              />
            </div>
          </div>
        </div>
      </ProtectedSplitPageContent>
    </ProtectedSplitPageLayout>
  )
}
