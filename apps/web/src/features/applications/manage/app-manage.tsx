'use client'

import { useState } from 'react'
import { IconDeviceFloppy, IconTrash } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { MutationButton } from '@/components/ui/mutation-button'
import { Visible } from '@/components/ui/visible'
import { AppResourceNavigation } from '@/features/applications/detail/app-resource-navigation'
import { AppViewerStatusSection } from '@/features/applications/detail/app-viewer-status-section'
import { useApplicationViewerApp } from '@/features/applications/detail/application-viewer-context'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { AppViewerDeleteAction } from '@/features/applications/viewer/actions/app-viewer-delete-action'
import { AppViewerHeading } from '@/features/applications/viewer/components/heading'
import { AndroidNotifications } from '@/features/applications/viewer/notifications/android-notifications'
import { toast } from '@/hooks/use-toast'
import { updateApplicationAction } from '@/server/orchestrator/applications/actions/configuration/create-update-actions'
import { appResourceHref } from '@/shared/model/applications/app-resource-links'
import { useResourceLimitBounds } from '@/shared/model/settings/use-resource-limit-bounds'
import { hasPermission } from '@/shared/permissions/permissions'
import { EditorPage } from '@/shared/ui/page/editor-page'
import { PageContent } from '@/shared/ui/page/page-layout'
import { AppConfigurationMenu } from './app-configuration-menu'
import { AppManageGeneralSettings } from './app-manage-general-settings'
import { AppManageIconPanel } from './app-manage-icon-panel'
import { AppManageRuntimeSettings } from './app-manage-runtime-settings'
import { buildAppManageUpdateInput, mergeAppPreservingDraftAssets, useAppManageDraft } from './use-app-manage-draft'

export const AppManage = () => {
  const {
    app: currentApp,
    setApp,
    permissions,
    initialSettings,
    isForeignOwnedApp,
    canViewAuditActivity
  } = useApplicationViewerApp()
  const [isSaving, setIsSaving] = useState(false)
  const router = useRouter()
  const { displayApp, draft, formValues, markSaved, updateForm, updateIcon } = useAppManageDraft(currentApp)
  const canChangeSessionLimit = hasPermission(permissions, 'applications:change-session-limit')
  const canChangeResources = hasPermission(permissions, 'applications:change-resources')
  const canChangeContainerArgs = hasPermission(permissions, 'applications:change-container-args')
  const canViewBackendDetails = hasPermission(permissions, 'applications:view-backend-details')
  const canViewLogs = hasPermission(permissions, 'applications:view-logs')
  const canDelete = hasPermission(permissions, 'applications:delete')
  const profilesHref = appResourceHref(currentApp.id, 'profiles')
  const showRuntimeSection =
    canChangeSessionLimit || canChangeResources || canChangeContainerArgs || canViewBackendDetails
  const resourceLimits = useResourceLimitBounds(canChangeResources)

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
      const nextApp = mapAndroidApplicationToAppDefinition(updated)
      markSaved()
      setApp(current => mergeAppPreservingDraftAssets(nextApp, current))
      toast({ title: 'App saved', variant: 'success' })
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
    <EditorPage>
      <PageContent>
        <AppViewerHeading
          app={displayApp}
          showStatusBadge
        >
          {canDelete ? (
            <AppViewerDeleteAction
              app={displayApp}
              initialSettings={initialSettings}
              renderTrigger={({ disabled, label, onClick }) => (
                <AppConfigurationMenu profilesHref={profilesHref}>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={disabled}
                    onSelect={onClick}
                    className='text-danger'
                  >
                    <IconTrash className='size-4' />
                    {label}
                  </DropdownMenuItem>
                </AppConfigurationMenu>
              )}
            />
          ) : (
            <AppConfigurationMenu profilesHref={profilesHref} />
          )}
          <MutationButton
            pending={isSaving}
            pendingLabel='Saving…'
            onClick={() => void handleSave()}
          >
            <IconDeviceFloppy className='size-4' />
            Save
          </MutationButton>
        </AppViewerHeading>
        <AppResourceNavigation
          appId={currentApp.id}
          active='configuration'
          canViewAuditActivity={canViewAuditActivity}
          permissions={permissions}
          isForeignOwnedApp={isForeignOwnedApp}
        />
        <Visible when={isForeignOwnedApp}>
          <Badge
            variant='outline'
            className='w-fit'
          >
            Owner: {currentApp.ownerDisplayName ?? currentApp.ownerUserId ?? 'Unknown'}
          </Badge>
        </Visible>
        <div className='flex w-full min-w-0 flex-col gap-6 pb-16'>
          <AppViewerStatusSection
            app={currentApp}
            canDiagnose={canViewBackendDetails || (canViewLogs && !isForeignOwnedApp)}
            showErrorDetails={canViewBackendDetails}
          />
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
        </div>
      </PageContent>
    </EditorPage>
  )
}
