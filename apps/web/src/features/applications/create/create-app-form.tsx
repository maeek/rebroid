'use client'

import { ChangeEvent, FormEvent, useEffect, useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTopLoader } from 'nextjs-toploader'
import { MutationButton } from '@/components/ui/mutation-button'
import { Visible } from '@/components/ui/visible'
import { uploadApkWithFeedback } from '@/features/applications/apks/upload-apk-with-feedback'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { setAppIconAction } from '@/server/app-icons/actions/set-app-icon-action'
import { createApplicationAction } from '@/server/orchestrator/applications/actions/configuration/create-update-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { optimizeIconFile } from '@/shared/model/media/icon-metadata'
import { runtimeKindForImageReference } from '@/shared/model/runtime-image/runtime-image-metadata'
import { useOrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'
import { useResourceLimitBounds } from '@/shared/model/settings/use-resource-limit-bounds'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import { PageBackdrop } from '@/shared/ui/page/page-backdrop'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent } from '@/shared/ui/page/page-layout'
import { CreateAppDeviceSection } from './create-app-device-section'
import { CreateAppDisplaySection } from './create-app-display-section'
import {
  appNameFromApk,
  buildCreateApplicationInput,
  getCustomDisplayConfig,
  getInitialCreateAppFormValues,
  isCreateAppSubmitDisabled
} from './create-app-form-model'
import { AppFormGeneralSection } from './create-app-general-section'
import { CreateAppGooglePlayGuidance } from './create-app-google-play-guidance'
import { AppFormIconSection } from './create-app-icon-section'
import { CreateAppNetworkAccessSection } from './create-app-network-access-section'
import { AppFormResourcesSection } from './create-app-resources-section'
import { AppFormSessionSection } from './create-app-session-section'
import type { CreateAppFormValues } from './create-app-form.types'
import type { UploadedApk } from '@/shared/contracts/application'
import type { PlatformImage } from '@/shared/contracts/platform'
import type { OrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'

export const CreateAppForm = ({
  images,
  initialContainerImage,
  initialSettings,
  permissions,
  initialUploadedApk,
  canBuildImages
}: {
  images: PlatformImage[]
  initialContainerImage?: string
  initialSettings: OrchestratorUiSettings
  permissions: PermissionMap
  initialUploadedApk?: UploadedApk | null
  canBuildImages: boolean
}) => {
  const topLoader = useTopLoader()
  const createFormId = useId()
  const settings = useOrchestratorUiSettings(initialSettings, { refreshOnMount: false })
  const [formValues, setFormValues] = useState<CreateAppFormValues>(() => {
    const initial = getInitialCreateAppFormValues(settings)
    return {
      ...initial,
      name: initialUploadedApk ? appNameFromApk(initialUploadedApk.originalName, initialUploadedApk) : initial.name,
      containerImage: initialContainerImage?.trim() || settings.defaultContainerImage
    }
  })
  const [uploadedApk, setUploadedApk] = useState<UploadedApk | null>(initialUploadedApk ?? null)
  const [isUploadingApk, setIsUploadingApk] = useState(false)
  const [manualIconPreview, setManualIconPreview] = useState<string | null>(null)
  const [autoExtractIcon, setAutoExtractIcon] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const router = useRouter()
  const extractedIcon = uploadedApk?.extractedIconDataUrl ?? null
  const iconPreview = manualIconPreview ?? (autoExtractIcon ? extractedIcon : null)
  const canChangeBaseImage = hasPermission(permissions, 'applications:change-base-image')
  const canChangeSessionLimit = hasPermission(permissions, 'applications:change-session-limit')
  const canChangeResources = hasPermission(permissions, 'applications:change-resources')
  const canChangeContainerArgs = hasPermission(permissions, 'applications:change-container-args')
  const canConfigureEgress = hasPermission(permissions, 'applications:configure-egress')
  const canUseInternet = hasPermission(permissions, 'applications:use-internet')
  const runtimeKind = runtimeKindForImageReference(images, formValues.containerImage)
  const isRedroidRuntime = runtimeKind === 'redroid'
  const showDeviceSection = canChangeBaseImage || canChangeContainerArgs
  const showSessionSection = canChangeSessionLimit
  const showResourcesSection = canChangeResources
  const showRuntimeSection = showDeviceSection || Boolean(uploadedApk)
  const showAdvancedSection = showSessionSection || showResourcesSection
  const resourceLimits = useResourceLimitBounds(showResourcesSection)
  const customDisplayConfig =
    formValues.redroidDisplayProfileId === 'custom' ? getCustomDisplayConfig(formValues) : undefined

  useEffect(() => {
    setFormValues(current => ({
      ...current,
      containerImage: initialContainerImage?.trim() || settings.defaultContainerImage,
      inactivityTimeoutSeconds: settings.defaultInactivityTimeoutSeconds,
      redroidExtraArgs: '',
      customContainerArgs: ''
    }))
  }, [initialContainerImage, settings.defaultInactivityTimeoutSeconds, settings.defaultContainerImage])

  const updateFormValues = (patch: Partial<CreateAppFormValues>) => {
    setFormValues(current => ({ ...current, ...patch }))
  }

  const trimmedName = formValues.name.trim()
  const isSubmitDisabled = isCreateAppSubmitDisabled({
    canChangeContainerArgs,
    customDisplayConfig,
    isCreating,
    isRedroidRuntime,
    isUploadingApk,
    trimmedName,
    values: formValues
  })

  const handleIconChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null

    if (!file) {
      setManualIconPreview(null)
      return
    }

    try {
      setManualIconPreview(await optimizeIconFile(file))
    } catch (error) {
      toast({
        title: 'Could not prepare icon',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    }
  }

  const handleClearIcon = () => {
    if (!manualIconPreview && extractedIcon) {
      setAutoExtractIcon(false)
      return
    }

    setManualIconPreview(null)
  }

  const handleApkSelect = async (file: File | null) => {
    setUploadedApk(null)

    if (!file) {
      return
    }

    setIsUploadingApk(true)

    try {
      const uploaded = await uploadApkWithFeedback({
        errorTitle: 'Could not upload APK',
        file,
        maxApkUploadSizeMb: settings.maxApkUploadSizeMb,
        topLoader
      })
      if (!uploaded) return

      setUploadedApk(uploaded)
      if (!formValues.name.trim()) {
        updateFormValues({ name: appNameFromApk(file.name, uploaded) })
      }

      if (!uploaded.extractedIconDataUrl) {
        toast({
          title: 'APK uploaded',
          description: 'No direct launcher icon was found in the APK.',
          variant: 'success'
        })
      } else {
        toast({ title: 'APK uploaded', description: 'Launcher icon was extracted.', variant: 'success' })
      }
    } finally {
      setIsUploadingApk(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isSubmitDisabled) {
      return
    }

    setIsCreating(true)
    topLoader.start()
    topLoader.setProgress(0.1)

    try {
      const createdApp = await createApplicationAction(
        buildCreateApplicationInput({
          canChangeBaseImage,
          canChangeContainerArgs,
          canChangeResources,
          canChangeSessionLimit,
          canConfigureEgress,
          canUseInternet,
          customDisplayConfig,
          isRedroidRuntime,
          runtimeKind,
          trimmedName,
          uploadedApk,
          values: formValues
        })
      )

      topLoader.setProgress(iconPreview ? 0.65 : 0.9)

      if (iconPreview) {
        try {
          unwrapActionResult(await setAppIconAction(createdApp.id, iconPreview))
        } catch (error) {
          toast({
            title: 'App created without icon',
            description: getDisplayErrorMessage(error, 'Could not save the icon.'),
            variant: 'danger'
          })
        }
      }

      topLoader.setProgress(1)
      toast({ title: 'App created', description: 'Provisioning has started.', variant: 'success' })
      router.push(`/app/${createdApp.id}`)
    } catch (error) {
      topLoader.done(true)
      toast({
        title: 'Could not create app',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <>
      <PageHeader
        section={{ label: 'Apps', href: '/apps' }}
        title='Create app'
        description='Configure the app identity, Android runtime, access, and resource limits.'
        actions={
          <MutationButton
            form={createFormId}
            type='submit'
            pending={isCreating}
            pendingLabel='Creating…'
            disabled={isSubmitDisabled}
          >
            Create app
          </MutationButton>
        }
      />
      <Visible when={iconPreview}>
        <PageBackdrop
          imageSrc={iconPreview}
          opacity={0.08}
        />
      </Visible>
      <PageContent>
        <form
          id={createFormId}
          className='flex w-full flex-col pb-24'
          onSubmit={event => void handleSubmit(event)}
        >
          <div className='border-b border-surface-border/60 pb-6'>
            <div>
              <h2 className='font-medium'>General</h2>
              <p className='mt-1 text-sm text-foreground-muted'>Choose the app identity, APK, and runtime.</p>
            </div>
          </div>

          <div className='py-8'>
            <AppFormGeneralSection
              values={formValues}
              onChange={updateFormValues}
              uploadedApk={uploadedApk}
              isUploadingApk={isUploadingApk}
              onApkSelect={file => void handleApkSelect(file)}
              iconSlot={
                <AppFormIconSection
                  appName={trimmedName}
                  iconPreview={iconPreview}
                  autoExtractIcon={autoExtractIcon}
                  hasExtractedIcon={Boolean(extractedIcon)}
                  surface='plain'
                  showDescription={false}
                  onIconChange={event => void handleIconChange(event)}
                  onClearIcon={handleClearIcon}
                  onAutoExtractIconChange={setAutoExtractIcon}
                />
              }
            />
          </div>

          <Visible when={showRuntimeSection}>
            <div className='border-t border-surface-border/60 py-8'>
              <Visible when={showDeviceSection}>
                <CreateAppDeviceSection
                  images={images}
                  values={formValues}
                  onChange={updateFormValues}
                  canChangeBaseImage={canChangeBaseImage}
                  canChangeContainerArgs={canChangeContainerArgs}
                  isRedroidRuntime={isRedroidRuntime}
                />
              </Visible>
              {uploadedApk ? (
                <div className={showDeviceSection ? 'mt-6' : undefined}>
                  <CreateAppGooglePlayGuidance
                    uploadedApk={uploadedApk}
                    images={images}
                    selectedImage={formValues.containerImage}
                    canChangeImage={canChangeBaseImage}
                    canBuildImages={canBuildImages}
                    onUseImage={image => updateFormValues({ containerImage: image })}
                  />
                </div>
              ) : null}
            </div>
          </Visible>

          <Visible when={isRedroidRuntime && canChangeContainerArgs}>
            <div className='border-t border-surface-border/60 py-8'>
              <CreateAppDisplaySection
                values={formValues}
                onChange={updateFormValues}
              />
            </div>
          </Visible>

          <Visible when={canConfigureEgress}>
            <div className='border-t border-surface-border/60 py-8'>
              <CreateAppNetworkAccessSection
                values={formValues}
                canUseInternet={canUseInternet}
                onChange={updateFormValues}
              />
            </div>
          </Visible>

          <Visible when={showAdvancedSection}>
            <div className='border-t border-surface-border/60 py-8'>
              <div className='mb-8'>
                <h2 className='font-medium'>Advanced</h2>
                <p className='mt-1 text-sm text-foreground-muted'>Optional lifecycle and resource limits.</p>
              </div>
              <Visible when={showSessionSection}>
                <AppFormSessionSection
                  values={formValues}
                  onChange={updateFormValues}
                />
              </Visible>
              <Visible when={showResourcesSection}>
                <div className={showSessionSection ? 'mt-8 border-t border-surface-border/60 pt-8' : undefined}>
                  <AppFormResourcesSection
                    values={formValues}
                    resourceLimits={resourceLimits}
                    onChange={updateFormValues}
                  />
                </div>
              </Visible>
            </div>
          </Visible>
        </form>
      </PageContent>
    </>
  )
}
