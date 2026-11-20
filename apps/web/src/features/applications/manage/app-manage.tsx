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
import { useAppRuntimeValidation } from '@/features/applications/hooks/use-app-runtime-validation'
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
import { appRuntimeFields, type AppRuntimeFieldErrors } from '../model/app-runtime-settings'
import { AppConfigurationMenu } from './app-configuration-menu'
import { AppManageGeneralSettings } from './app-manage-general-settings'
import { AppManageRuntimeSettings } from './app-manage-runtime-settings'
import {
  appManageDraftFromApp,
  buildAppManageUpdateInput,
  mergeAppConfiguration,
  useAppManageDraft,
  type AppConfigurationSettings
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
  const [runtimeErrors, setRuntimeErrors] = useState<AppRuntimeFieldErrors>({})
  const nameInput = useRef<HTMLInputElement>(null)
  const configurationFields = useRef<HTMLFieldSetElement>(null)
  const router = useRouter()
  const canChangeSessionLimit = hasPermission(permissions, 'applications:change-session-limit')
  const canChangeResources = hasPermission(permissions, 'applications:change-resources')
  const canChangeContainerArgs = hasPermission(permissions, 'applications:change-container-args')
  const {
    discardChanges,
    displayApp,
    draft,
    modified,
    isDirty,
    isIconDirty,
    isSettingsDirty,
    resetIcon,
    resetSettings,
    updateForm,
    updateIcon
  } = useAppManageDraft(currentApp, { canChangeSessionLimit, canChangeResources, canChangeContainerArgs })
  const saveFeedback = useSaveFeedback(JSON.stringify(draft))
  const canViewBackendDetails = hasPermission(permissions, 'applications:view-backend-details')
  const canViewLogs = hasPermission(permissions, 'applications:view-logs')
  const canDelete = hasPermission(permissions, 'applications:delete')
  const profilesHref = appResourceHref(currentApp.id, 'profiles')
  const showRuntimeSection =
    canChangeSessionLimit || canChangeResources || canChangeContainerArgs || canViewBackendDetails
  const resourceLimits = useResourceLimitBounds(canChangeResources)
  const runtimeValidation = useAppRuntimeValidation(
    configurationFields,
    draft,
    {
      inactivityTimeoutSeconds: canChangeSessionLimit,
      memoryLimitMb: canChangeResources,
      cpuLimitCpus: canChangeResources
    },
    resourceLimits,
    modified
  )
  const isRuntimeInvalid = Object.keys(runtimeValidation.errors).length > 0

  const updateRuntime = (patch: Partial<AppConfigurationSettings>) => {
    setRuntimeErrors(current => {
      const next = { ...current }
      for (const field of appRuntimeFields) {
        if (patch[field] !== undefined) delete next[field]
      }
      return next
    })
    updateForm(patch)
  }

  useEffect(() => {
    if (nameError) nameInput.current?.focus()
  }, [nameError])

  const handleSave = async () => {
    if (!isDirty || isSaving || isPreparingIcon || Object.keys(runtimeValidation.validate()).length > 0) return
    saveFeedback.resetSaveFeedback()
    setIsSaving(true)
    setNameError(undefined)
    setRuntimeErrors({})
    setIconSaveError(undefined)
    let savedApp = currentApp
    try {
      if (isSettingsDirty) {
        const result = await updateApplicationAction(currentApp.id, buildAppManageUpdateInput(draft, modified))
        if (!result.ok && result.error.fieldErrors) {
          const errors = result.error.fieldErrors
          const nextRuntimeErrors: AppRuntimeFieldErrors = {}
          for (const field of appRuntimeFields) {
            if (errors[field]?.length) nextRuntimeErrors[field] = errors[field].join(' ')
          }
          if (errors.name?.length || Object.keys(nextRuntimeErrors).length > 0) {
            setNameError(errors.name?.join(' '))
            setRuntimeErrors(nextRuntimeErrors)
            return
          }
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
            disabled={isPreparingIcon || isRuntimeInvalid || (!isDirty && !saveFeedback.saved)}
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
            ref={configurationFields}
            className='contents'
            disabled={isSaving}
            onInput={runtimeValidation.onInput}
          >
            <AppManageGeneralSettings
              app={currentApp}
              appId={currentApp.id}
              canReplaceApk={!isForeignOwnedApp && hasPermission(permissions, 'applications:update-apk')}
              canUploadApk={hasPermission(permissions, 'applications:upload-apk')}
              name={draft.name}
              nameModified={modified.name}
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
                values={draft}
                modified={modified}
                errors={{ ...runtimeErrors, ...runtimeValidation.errors }}
                resourceLimits={resourceLimits}
                canChangeSessionLimit={canChangeSessionLimit}
                canChangeResources={canChangeResources}
                canChangeContainerArgs={canChangeContainerArgs}
                canViewBackendDetails={canViewBackendDetails}
                onChange={updateRuntime}
              />
            </Visible>
          </fieldset>
        </div>
      </PageContent>
      <UnsavedChangesGuard
        dirty={isDirty || isRuntimeInvalid || isPreparingIcon}
        onDiscard={() => {
          discardChanges()
          setRuntimeErrors({})
          setNameError(undefined)
        }}
      />
    </EditorPage>
  )
}
