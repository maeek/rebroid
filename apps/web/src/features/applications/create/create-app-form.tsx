'use client'

import { ChangeEvent, FormEvent, useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTopLoader } from 'nextjs-toploader'
import { Button } from '@/components/ui/button'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { uploadApkWithFeedback } from '@/features/applications/apks/upload-apk-with-feedback'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { setAppIconAction } from '@/server/app-icons/actions/set-app-icon-action'
import { submitCreateApplicationAction } from '@/server/orchestrator/applications/actions/configuration/create-update-actions'
import { isActionResult, unwrapActionResult } from '@/shared/actions/action-result'
import { unconfirmedAppCreationMessage } from '@/shared/contracts/application'
import { isApplicationId } from '@/shared/model/application-id'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
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
  validateCreateAppDraft,
  validateCreateAppNumericFields
} from './create-app-form-model'
import { AppFormGeneralSection } from './create-app-general-section'
import { CreateAppGooglePlayGuidance } from './create-app-google-play-guidance'
import { AppFormIconSection } from './create-app-icon-section'
import { CreateAppLayout } from './create-app-layout'
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
  canBuildImages,
  loading = false
}: {
  loading?: boolean
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
  const [failure, setFailure] = useState<{ message: string; requestId?: string; hasFieldErrors?: boolean } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const submitting = useRef(false)
  const form = useRef<HTMLFormElement>(null)
  const failureSummary = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const extractedIcon = uploadedApk?.extractedIconDataUrl ?? null
  const iconPreview = manualIconPreview ?? (autoExtractIcon ? extractedIcon : null)
  const canChangeBaseImage = hasPermission(permissions, 'applications:change-base-image')
  const canChangeSessionLimit = hasPermission(permissions, 'applications:change-session-limit')
  const canChangeResources = hasPermission(permissions, 'applications:change-resources')
  const canChangeContainerArgs = hasPermission(permissions, 'applications:change-container-args')
  const { isFeatureEnabled } = useFeatureFlags()
  const canConfigureEgress =
    isFeatureEnabled('feature.firewall') && hasPermission(permissions, 'applications:configure-egress')
  const canUseInternet = hasPermission(permissions, 'applications:use-internet')
  const runtimeKind = runtimeKindForImageReference(images, formValues.containerImage)
  const isRedroidRuntime = runtimeKind === 'redroid'
  const showDeviceSection = canChangeBaseImage || canChangeContainerArgs
  const showSessionSection = canChangeSessionLimit
  const showResourcesSection = canChangeResources
  const showRuntimeSection = showDeviceSection || Boolean(uploadedApk)
  const showAdvancedSection = showSessionSection || showResourcesSection
  const resourceLimits = useResourceLimitBounds(showResourcesSection && !loading)
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

  useEffect(() => {
    if (failure) failureSummary.current?.focus()
  }, [failure])

  const clearFieldErrors = (...fields: string[]) => {
    setFieldErrors(current => Object.fromEntries(Object.entries(current).filter(([field]) => !fields.includes(field))))
  }

  const updateFormValues = (patch: Partial<CreateAppFormValues>) => {
    setFormValues(current => ({ ...current, ...patch }))
    const keys = Object.keys(patch)
    if (
      (patch.redroidDisplayProfileId && patch.redroidDisplayProfileId !== 'custom') ||
      patch.containerImage !== undefined
    ) {
      keys.push('redroidCustomDisplayWidth', 'redroidCustomDisplayHeight', 'redroidCustomDisplayDpi')
    }
    if (
      patch.redroidDisplayProfileId !== undefined ||
      patch.redroidExtraArgs !== undefined ||
      patch.redroidCustomDisplayWidth !== undefined ||
      patch.redroidCustomDisplayHeight !== undefined ||
      patch.redroidCustomDisplayDpi !== undefined ||
      patch.customContainerArgs !== undefined ||
      patch.containerImage !== undefined
    ) {
      keys.push('containerArgs')
    }
    clearFieldErrors(...keys)
  }

  const trimmedName = formValues.name.trim()
  const isSubmitDisabled = isCreating || isUploadingApk
  const fieldError = (field: string) => fieldErrors[field]?.join(' ')
  const hasFieldErrors = Object.keys(fieldErrors).length > 0

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
    clearFieldErrors('uploadedApkId')

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

    if (isSubmitDisabled || submitting.current || loading) return

    const draftErrors = {
      ...validateCreateAppDraft(formValues, isRedroidRuntime && canChangeContainerArgs),
      ...validateCreateAppNumericFields(event.currentTarget)
    }
    setFieldErrors(draftErrors)
    if (Object.keys(draftErrors).length > 0) {
      setFailure({ message: 'Review the highlighted fields and try again.', hasFieldErrors: true })
      return
    }

    setFailure(null)
    submitting.current = true
    setIsCreating(true)
    topLoader.start()
    topLoader.setProgress(0.1)

    try {
      const result = await submitCreateApplicationAction(
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

      if (!isActionResult(result)) throw new Error('Invalid create-app action result')
      if (!result.ok) {
        topLoader.done(true)
        const errors = result.error.fieldErrors ?? {}
        setFailure({ ...result.error, hasFieldErrors: Object.keys(errors).length > 0 })
        setFieldErrors(errors)
        return
      }
      const createdApp = result.data
      if (!isApplicationId(createdApp?.id)) {
        topLoader.done(true)
        setFailure({ message: unconfirmedAppCreationMessage, requestId: result.requestId })
        return
      }
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
      toast({
        title: 'App creation started',
        description: 'Track provisioning on the app page.',
        variant: 'success'
      })
      router.push(`/app/${createdApp.id}`)
    } catch {
      topLoader.done(true)
      setFailure({ message: unconfirmedAppCreationMessage })
    } finally {
      submitting.current = false
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
            disabled={loading || isSubmitDisabled}
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
          ref={form}
          id={createFormId}
          className='w-full'
          noValidate
          onSubmit={event => void handleSubmit(event)}
        >
          <CreateAppLayout>
            {failure ? (
              <div
                ref={failureSummary}
                tabIndex={-1}
              >
                <Notice
                  tone='danger'
                  title='Could not create app'
                  description={
                    failure.hasFieldErrors && !hasFieldErrors
                      ? 'Try creating the app again with your updated settings.'
                      : failure.message
                  }
                  actions={
                    hasFieldErrors ? (
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={() => {
                          const controls = form.current?.querySelectorAll<HTMLElement>('[aria-invalid="true"]')
                          const first = Array.from(controls ?? []).find(
                            control => !control.closest('[hidden], [inert], [aria-hidden="true"], :disabled')
                          )
                          first?.focus()
                        }}
                      >
                        Go to first error
                      </Button>
                    ) : null
                  }
                >
                  {failure.requestId ? (
                    <p className='text-xs text-foreground-muted'>Request ID {failure.requestId}</p>
                  ) : null}
                </Notice>
              </div>
            ) : null}
            <div>
              <AppFormGeneralSection
                values={formValues}
                onChange={updateFormValues}
                uploadedApk={uploadedApk}
                isUploadingApk={isUploadingApk}
                nameError={fieldError('name')}
                apkError={fieldError('uploadedApkId')}
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
              <div>
                <Visible when={showDeviceSection}>
                  <CreateAppDeviceSection
                    images={images}
                    values={formValues}
                    onChange={updateFormValues}
                    canChangeBaseImage={canChangeBaseImage}
                    canChangeContainerArgs={canChangeContainerArgs}
                    isRedroidRuntime={isRedroidRuntime}
                    imageError={fieldError('containerImage')}
                    argumentsError={fieldError('containerArgs')}
                    displaySlot={
                      isRedroidRuntime && canChangeContainerArgs ? (
                        <CreateAppDisplaySection
                          values={formValues}
                          onChange={updateFormValues}
                          fieldErrors={fieldErrors}
                        />
                      ) : null
                    }
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

            <Visible when={canConfigureEgress}>
              <div>
                <CreateAppNetworkAccessSection
                  values={formValues}
                  canUseInternet={canUseInternet}
                  onChange={updateFormValues}
                  modeError={fieldError('networkPolicyEnabled')}
                  allowlistError={fieldError('networkPolicyAllowCidrs')}
                />
              </div>
            </Visible>

            <Visible when={showAdvancedSection}>
              <Section
                surface='plain'
                title='Lifecycle and resources'
                description='Optional lifecycle and resource limits.'
                collapsible
                summary={
                  formValues.memoryLimitMb || formValues.cpuLimitCpus
                    ? 'Resource overrides configured'
                    : 'Runtime defaults'
                }
              >
                <Visible when={showSessionSection}>
                  <AppFormSessionSection
                    values={formValues}
                    onChange={updateFormValues}
                    timeoutError={fieldError('inactivityTimeoutSeconds')}
                  />
                </Visible>
                <Visible when={showResourcesSection}>
                  <div className={showSessionSection ? 'mt-6' : undefined}>
                    <AppFormResourcesSection
                      values={formValues}
                      resourceLimits={resourceLimits}
                      onChange={updateFormValues}
                      memoryError={fieldError('memoryLimitMb')}
                      cpuError={fieldError('cpuLimitCpus')}
                    />
                  </div>
                </Visible>
              </Section>
            </Visible>
          </CreateAppLayout>
        </form>
      </PageContent>
    </>
  )
}
