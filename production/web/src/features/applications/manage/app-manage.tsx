'use client'

import { useEffect, useRef, useState } from 'react'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Visible } from '@/components/ui/visible'
import { AppViewerStatusSection } from '@/features/applications/detail/app-viewer-status-section'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { getAppRefreshIntervalMs } from '@/features/applications/domain/refresh'
import { resolveAppIconUrl } from '@/features/applications/icons/url'
import { AppViewerDeleteAction } from '@/features/applications/viewer/actions/app-viewer-delete-action'
import { AppLogsDialog } from '@/features/applications/viewer/app-logs-dialog'
import { AppViewerHeading } from '@/features/applications/viewer/heading'
import { BlurredImageBackdrop } from '@/features/shell/components/blurred-image-backdrop'
import { PageBreadcrumbs } from '@/features/shell/components/page-breadcrumbs'
import { ProtectedSplitPageContent, ProtectedSplitPageLayout } from '@/features/shell/components/protected-page-shell'
import { useForegroundRefresh } from '@/hooks/use-foreground-refresh'
import { toast } from '@/hooks/use-toast'
import { updateApplicationAction } from '@/server/orchestrator/applications/mutation-actions'
import { getApplicationAction } from '@/server/orchestrator/applications/read-actions'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import { AppManageGeneralSettings } from './app-manage-general-settings'
import { AppManageIconPanel } from './app-manage-icon-panel'
import { AppManageNetworkPolicySettings } from './app-manage-network-policy-settings'
import { AppManageRuntimeSettings } from './app-manage-runtime-settings'
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

  useForegroundRefresh({
    enabled: Boolean(currentAppId),
    intervalMs: refreshIntervalMs,
    refresh: async () => {
      if (!currentAppId) {
        return
      }

      try {
        const nextApp = await getApplicationAction(currentAppId)
        setCurrentApp(current => mergeAppPreservingIcon(mapAndroidApplicationToAppDefinition(nextApp), current))
      } catch {
        // Keep the last known app state on transient refresh failures.
      }
    }
  })

  if (!currentApp) {
    return <div className='p-4'>App not found</div>
  }

  const displayApp = { ...currentApp, name: appName, icon }

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
      <BlurredImageBackdrop imageSrc={displayApp.icon ? resolveAppIconUrl(displayApp.icon) : null} />
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
            <Visible when={canDelete}>
              <AppViewerDeleteAction
                app={displayApp}
                initialSettings={initialSettings}
              />
            </Visible>
            <Visible when={canViewLogs && !isForeignOwnedApp}>
              <AppLogsDialog app={currentApp} />
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
              appName={appName}
              initialSettings={initialSettings}
              onAppNameChange={value => {
                hasPendingAppChangesRef.current = true
                setAppName(value)
              }}
            />
            <Visible when={showRuntimeSection}>
              <AppManageRuntimeSettings
                app={currentApp}
                inactivityTimeoutSeconds={inactivityTimeoutSeconds}
                memoryLimitMb={memoryLimitMb}
                cpuLimitCpus={cpuLimitCpus}
                volumeSizeLimitMb={volumeSizeLimitMb}
                containerArgs={containerArgs}
                canChangeSessionLimit={canChangeSessionLimit}
                canChangeResources={canChangeResources}
                canChangeContainerArgs={canChangeContainerArgs}
                canViewBackendDetails={canViewBackendDetails}
                onInactivityTimeoutChange={value => {
                  hasPendingAppChangesRef.current = true
                  setInactivityTimeoutSeconds(value)
                }}
                onMemoryLimitChange={value => {
                  hasPendingAppChangesRef.current = true
                  setMemoryLimitMb(value)
                }}
                onCpuLimitChange={value => {
                  hasPendingAppChangesRef.current = true
                  setCpuLimitCpus(value)
                }}
                onVolumeSizeLimitChange={value => {
                  hasPendingAppChangesRef.current = true
                  setVolumeSizeLimitMb(value)
                }}
                onContainerArgsChange={value => {
                  hasPendingAppChangesRef.current = true
                  setContainerArgs(value)
                }}
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
          </div>
        </div>
      </ProtectedSplitPageContent>
    </ProtectedSplitPageLayout>
  )
}
