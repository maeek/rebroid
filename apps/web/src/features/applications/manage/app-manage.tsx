'use client'

import { useEffect, useRef, useState } from 'react'
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
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { setAppIconAction } from '@/server/app-icons/actions/set-app-icon-action'
import { updateApplicationAction } from '@/server/orchestrator/applications/actions/configuration/create-update-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { appResourceHref } from '@/shared/model/applications/app-resource-links'
import { notifyRecentAppsUpdated } from '@/shared/model/recent-apps/recent-apps'
import { useResourceLimitBounds } from '@/shared/model/settings/use-resource-limit-bounds'
import { hasPermission } from '@/shared/permissions/permissions'
import { EditorPage } from '@/shared/ui/page/editor-page'
import { PageContent } from '@/shared/ui/page/page-layout'
import { UnsavedChangesGuard } from '@/shared/ui/unsaved-changes-dialog'
import { AppConfigurationMenu } from './app-configuration-menu'
import { AppManageGeneralSettings } from './app-manage-general-settings'
import { AppManageRuntimeSettings } from './app-manage-runtime-settings'
import {
  appManageDraftFromApp,
  buildAppManageUpdateInput,
  mergeAppConfiguration,
  useAppManageDraft
} from './use-app-manage-draft'

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
  const [isPreparingIcon, setIsPreparingIcon] = useState(false)
  const [iconSaveError, setIconSaveError] = useState<string>()
  const [nameError, setNameError] = useState<string>()
  const nameInput = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const {
    discardChanges,
    displayApp,
    draft,
    formValues,
    isDirty,
    isIconDirty,
    isSettingsDirty,
    resetIcon,
    resetSettings,
    updateForm,
    updateIcon
  } = useAppManageDraft(currentApp)
  const saveFeedback = useSaveFeedback(JSON.stringify(draft))
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

  useEffect(() => {
    if (nameError) nameInput.current?.focus()
  }, [nameError])

  const handleSave = async () => {
    if (!isDirty || isSaving || isPreparingIcon) return
    saveFeedback.resetSaveFeedback()
    setIsSaving(true)
    setNameError(undefined)
    setIconSaveError(undefined)
    let savedApp = currentApp
    try {
      if (isSettingsDirty) {
        const result = await updateApplicationAction(
          currentApp.id,
          buildAppManageUpdateInput({
            canChangeContainerArgs,
            canChangeResources,
            canChangeSessionLimit,
            currentApp,
            draft
          })
        )
        if (!result.ok && result.error.fieldErrors?.name) {
          setNameError(result.error.fieldErrors.name.join(' '))
          return
        }
        const nextApp = mapAndroidApplicationToAppDefinition(unwrapActionResult(result))
        savedApp = mergeAppConfiguration(nextApp, currentApp)
        setApp(current => mergeAppConfiguration(nextApp, current ?? currentApp))
        resetSettings()
        if (nextApp.name !== currentApp.name) notifyRecentAppsUpdated()
      }
      if (isIconDirty) {
        try {
          const icon = unwrapActionResult(await setAppIconAction(currentApp.id, draft.icon))
          savedApp = { ...savedApp, icon }
          setApp(current => (current ? { ...current, icon } : current))
          resetIcon()
          notifyRecentAppsUpdated()
        } catch (error) {
          const message = getDisplayErrorMessage(error, 'Could not save the icon change.')
          setIconSaveError(isSettingsDirty ? `Other app settings were saved. ${message}` : message)
          return
        }
      }
      saveFeedback.confirmSaved(JSON.stringify(appManageDraftFromApp(savedApp)))
      toast({ title: 'App saved', variant: 'success' })
      router.refresh()
    } catch (error) {
      toast({
        title: 'Could not save app',
        description: getDisplayErrorMessage(error),
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
            disabled={isPreparingIcon || (!isDirty && !saveFeedback.saved)}
            pendingLabel='Saving…'
            success={saveFeedback.saved}
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
          <fieldset
            className='contents'
            disabled={isSaving}
          >
            <AppManageGeneralSettings
              app={currentApp}
              appId={currentApp.id}
              canReplaceApk={!isForeignOwnedApp && hasPermission(permissions, 'applications:update-apk')}
              canUploadApk={hasPermission(permissions, 'applications:upload-apk')}
              values={formValues}
              initialSettings={initialSettings}
              iconEditor={{
                icon: draft.icon,
                modified: isIconDirty,
                pending: isPreparingIcon,
                disabled: isSaving || isForeignOwnedApp,
                saveError: iconSaveError,
                onPreparingChange: setIsPreparingIcon,
                onIconChange: icon => {
                  setIconSaveError(undefined)
                  updateIcon(icon)
                },
                onResetIcon: () => {
                  setIconSaveError(undefined)
                  resetIcon()
                }
              }}
              nameError={nameError}
              nameInputRef={nameInput}
              onAppNameChange={value => {
                setNameError(undefined)
                updateForm({ name: value })
              }}
            />
            <Visible when={showRuntimeSection}>
              <AppManageRuntimeSettings
                app={currentApp}
                disabled={isSaving}
                values={formValues}
                resourceLimits={resourceLimits}
                canChangeSessionLimit={canChangeSessionLimit}
                canChangeResources={canChangeResources}
                canChangeContainerArgs={canChangeContainerArgs}
                canViewBackendDetails={canViewBackendDetails}
                onChange={updateForm}
              />
            </Visible>
          </fieldset>
        </div>
      </PageContent>
      <UnsavedChangesGuard
        dirty={isDirty || isPreparingIcon}
        onDiscard={discardChanges}
      />
    </EditorPage>
  )
}
