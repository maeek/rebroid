'use client'

import { useEffect, useState } from 'react'
import { IconDatabase, IconDeviceFloppy } from '@tabler/icons-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MutationButton } from '@/components/ui/mutation-button'
import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { AppNotFoundSplash } from '@/features/applications/components/app-not-found-splash'
import { AppViewerStatusSection } from '@/features/applications/detail/app-viewer-status-section'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { getAppRefreshIntervalMs } from '@/features/applications/domain/refresh'
import { AppViewerDeleteAction } from '@/features/applications/viewer/actions/app-viewer-delete-action'
import { AppViewerHeading } from '@/features/applications/viewer/components/heading'
import { AppLogsContent } from '@/features/applications/viewer/logs/app-logs-content'
import { AndroidNotifications } from '@/features/applications/viewer/notifications/android-notifications'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { toast } from '@/hooks/use-toast'
import { updateApplicationAction } from '@/server/orchestrator/applications/actions/configuration/create-update-actions'
import { getApplicationAction } from '@/server/orchestrator/applications/actions/queries/get-application-action'
import { resolveAppIconUrl } from '@/shared/model/media/image-url'
import { useResourceLimitBounds } from '@/shared/model/settings/use-resource-limit-bounds'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import { PageBackdrop } from '@/shared/ui/page/page-backdrop'
import { PageBreadcrumbs } from '@/shared/ui/page/page-breadcrumbs'
import { PageContent, StandardPageSplit } from '@/shared/ui/page/page-layout'
import { AppManageGeneralSettings } from './app-manage-general-settings'
import { AppManageIconPanel } from './app-manage-icon-panel'
import { AppManageNetworkPolicySettings } from './app-manage-network-policy-settings'
import { AppManageRuntimeSettings } from './app-manage-runtime-settings'
import { AppManageTechnicalDetails } from './app-manage-technical-details'
import { buildAppManageUpdateInput, useAppManageDraft } from './use-app-manage-draft'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { OrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'

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
  const [isSaving, setIsSaving] = useState(false)
  const router = useRouter()
  const {
    currentApp,
    displayApp,
    draft,
    formValues,
    markSaved,
    mergeRefreshedApp,
    setCurrentApp,
    updateForm,
    updateIcon
  } = useAppManageDraft(app)
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
      mergeRefreshedApp(mapAndroidApplicationToAppDefinition(refreshedApp))
    }
  }, [mergeRefreshedApp, refreshedApp])

  if (!currentApp || !displayApp || !formValues) {
    return <AppNotFoundSplash />
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const updated = await updateApplicationAction(
        currentApp.id,
        buildAppManageUpdateInput({
          canChangeContainerArgs,
          canChangeResources,
          canChangeSessionLimit,
          draft
        })
      )
      markSaved(mapAndroidApplicationToAppDefinition(updated))
      toast({ title: 'App saved' })
      router.refresh()
    } catch (error) {
      toast({
        title: 'Could not save app',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'danger'
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <StandardPageSplit>
      <PageBackdrop
        imageSrc={displayApp.icon ? resolveAppIconUrl(displayApp.icon) : null}
        opacity={0.08}
      />
      <PageContent>
        <PageBreadcrumbs
          items={[
            { label: 'Apps', href: '/apps' },
            { label: draft.appName || currentApp.name, href: `/app/${currentApp.id}` },
            { label: 'Manage' }
          ]}
        />
        <AppViewerHeading app={displayApp}>
          <div className='flex gap-2'>
            <Button
              asChild
              variant='secondary'
            >
              <Link href={`/app/${currentApp.id}/manage/profiles`}>
                <IconDatabase className='size-4' />
                Profiles
              </Link>
            </Button>
            <Visible when={canDelete}>
              <AppViewerDeleteAction
                app={displayApp}
                initialSettings={initialSettings}
              />
            </Visible>
            <MutationButton
              pending={isSaving}
              pendingLabel='Saving…'
              onClick={() => void handleSave()}
            >
              <IconDeviceFloppy className='size-4' />
              Save
            </MutationButton>
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
        <div className='flex w-full min-w-0 flex-col gap-10 pb-24'>
          <AppViewerStatusSection app={currentApp} />
          <div className='[&:empty]:hidden'>
            <AndroidNotifications app={currentApp} />
          </div>
          <AppManageGeneralSettings
            app={currentApp}
            appId={currentApp.id}
            values={formValues}
            initialSettings={initialSettings}
            iconSlot={
              <AppManageIconPanel
                appId={currentApp.id}
                appName={draft.appName}
                icon={draft.icon}
                initialSettings={initialSettings}
                compact
                onIconChange={updateIcon}
              />
            }
            onAppNameChange={value => updateForm({ name: value })}
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
              onChange={updateForm}
            />
          </Visible>
          <Visible when={canConfigureEgress}>
            <AppManageNetworkPolicySettings
              app={currentApp}
              onUpdated={setCurrentApp}
            />
          </Visible>
          <Visible when={canViewBackendDetails}>
            <AppManageTechnicalDetails app={currentApp} />
          </Visible>
          <Visible when={canViewLogs && !isForeignOwnedApp}>
            <Section
              title='Logs'
              surface='panel'
              headingSpacing='default'
              contentClassName='min-h-[30rem]'
            >
              <AppLogsContent
                app={currentApp}
                className='min-h-112'
                outputClassName='min-h-[20rem] max-h-[40vh]'
              />
            </Section>
          </Visible>
        </div>
      </PageContent>
    </StandardPageSplit>
  )
}
