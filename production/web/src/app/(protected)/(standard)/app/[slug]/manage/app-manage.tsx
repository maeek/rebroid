'use client'

import { useEffect, useRef, useState } from 'react'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { PageBreadcrumbs } from '@/app/(protected)/_components/page-breadcrumbs'
import { ProtectedSplitPageContent, ProtectedSplitPageLayout } from '@/app/(protected)/_components/protected-page-shell'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { getApplicationAction, updateApplicationAction } from '@/lib/orchestrator/actions'
import { mapAndroidApplicationToAppDefinition } from '@/lib/orchestrator/app-mapper'
import { useForegroundRefresh } from '../../../../../../hooks/use-foreground-refresh'
import { getAppRefreshIntervalMs } from '../../../../../../lib/orchestrator/refresh'
import { AppViewerDeleteAction } from '../../../../_components/viewer/actions/app-viewer-delete-action'
import { AppLogsDialog } from '../../../../_components/viewer/app-logs-dialog'
import { AppViewerHeading } from '../../../../_components/viewer/heading'
import { AppViewerStatusSection } from '../app-viewer-status-section'
import { AppManageGeneralSettings } from './app-manage-general-settings'
import { AppManageIconPanel } from './app-manage-icon-panel'
import { AppManageNetworkPolicySettings } from './app-manage-network-policy-settings'
import { AppManageProfileSettings } from './app-manage-profile-settings'
import { AppManageRuntimeSettings } from './app-manage-runtime-settings'
import type { AppDefinition } from '../../../constants'

const mergeAppPreservingIcon = (nextApp: AppDefinition, currentApp?: AppDefinition) => ({
  ...nextApp,
  icon: currentApp?.icon ?? nextApp.icon
})

export default function AppManage({ app }: { app?: AppDefinition }) {
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
        inactivityTimeoutSeconds,
        memoryLimitMb: memoryLimitMb ? Number(memoryLimitMb) : null,
        cpuLimitCpus: cpuLimitCpus ? Number(cpuLimitCpus) : null,
        volumeSizeLimitMb: volumeSizeLimitMb ? Number(volumeSizeLimitMb) : null,
        containerArgs: containerArgs.trim() || null
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
      <div className='w-screen h-screen bg-primary/80 blur-3xl fixed top-0 left-0 -z-10 pointer-events-none opacity-5' />
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
            <AppViewerDeleteAction app={displayApp} />
            <AppLogsDialog app={currentApp} />
            <Button
              disabled={isSaving}
              onClick={() => void handleSave()}
            >
              <IconDeviceFloppy className='size-4' />
              Save
            </Button>
          </div>
        </AppViewerHeading>
        <div className='grid w-full grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)] items-start gap-6 pb-24 max-lg:grid-cols-1'>
          <div className='flex min-w-0 flex-col gap-5'>
            <AppViewerStatusSection app={currentApp} />
            <AppManageGeneralSettings
              app={currentApp}
              appId={currentApp.id}
              appName={appName}
              onAppNameChange={value => {
                hasPendingAppChangesRef.current = true
                setAppName(value)
              }}
            />
            <AppManageRuntimeSettings
              app={currentApp}
              inactivityTimeoutSeconds={inactivityTimeoutSeconds}
              memoryLimitMb={memoryLimitMb}
              cpuLimitCpus={cpuLimitCpus}
              volumeSizeLimitMb={volumeSizeLimitMb}
              containerArgs={containerArgs}
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
            <AppManageProfileSettings
              app={currentApp}
              onUpdated={setCurrentApp}
            />
            <AppManageNetworkPolicySettings
              app={currentApp}
              onUpdated={setCurrentApp}
            />
          </div>
          <div className='flex w-full min-w-0 flex-col gap-4'>
            <AppManageIconPanel
              appId={currentApp.id}
              appName={appName}
              icon={icon}
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
