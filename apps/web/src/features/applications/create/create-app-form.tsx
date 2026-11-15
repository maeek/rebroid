'use client'

import { ChangeEvent, FormEvent, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { IconPlus } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useTopLoader } from 'nextjs-toploader'
import { Button } from '@/components/ui/button'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { uploadApkWithFeedback } from '@/features/applications/apks/upload-apk-with-feedback'
import { AppIconField } from '@/features/applications/components/app-icon-field'
import { AppLifecycleFields } from '@/features/applications/components/app-lifecycle-fields'
import { AppNetworkPolicyEditorSection } from '@/features/applications/components/app-network-policy-editor-section'
import { parseOutboundDestinations } from '@/features/applications/components/outbound-destinations'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { cn } from '@/lib/utils'
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
import { compactPageActionClassName, CompactPageHeader } from '@/shared/ui/page/page-header'
import { PageContent } from '@/shared/ui/page/page-layout'
import { CreateAppDeviceSection } from './create-app-device-section'
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
import { CreateAppLayout } from './create-app-layout'
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
  const [pendingApkName, setPendingApkName] = useState<string | null>(null)
  const [apkUploadError, setApkUploadError] = useState<string>()
  const [manualIconPreview, setManualIconPreview] = useState<string | null>(null)
  const [isPreparingIcon, setIsPreparingIcon] = useState(false)
  const [iconError, setIconError] = useState<string>()
  const [autoExtractIcon, setAutoExtractIcon] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [nameEdited, setNameEdited] = useState(false)
  const [destinationDraft, setDestinationDraft] = useState('')
  const [failure, setFailure] = useState<{
    message: string
    requestId?: string
    hasFieldErrors?: boolean
    focusName?: boolean
  } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [numericErrors, setNumericErrors] = useState<Record<string, string[]>>({})
  const submitting = useRef(false)
  const form = useRef<HTMLFormElement>(null)
  const failureSummary = useRef<HTMLDivElement>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const isUploadingApk = pendingApkName !== null
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
  const resourceSummary =
    formValues.memoryLimitMb || formValues.cpuLimitCpus ? 'Custom RAM or CPU limits' : 'Default RAM and CPU limits'
  const resourceLimits = useResourceLimitBounds(showResourcesSection && !loading)
  const customDisplayConfig =
    formValues.redroidDisplayProfileId === 'custom' ? getCustomDisplayConfig(formValues) : undefined

  // Recheck native constraints when defaults or fetched limits change without an input event.
  useLayoutEffect(() => {
    if (form.current && !loading) setNumericErrors(validateCreateAppNumericFields(form.current))
  }, [
    formValues.cpuLimitCpus,
    formValues.inactivityTimeoutSeconds,
    formValues.memoryLimitMb,
    loading,
    resourceLimits?.maxCpuCpus,
    resourceLimits?.maxMemoryMb,
    showResourcesSection,
    showSessionSection
  ])

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
    if (failure?.focusName) nameInput.current?.focus()
    else if (failure) failureSummary.current?.focus()
  }, [failure])

  const clearFieldErrors = (...fields: string[]) => {
    setFieldErrors(current => Object.fromEntries(Object.entries(current).filter(([field]) => !fields.includes(field))))
  }

  const updateFormValues = (patch: Partial<CreateAppFormValues>) => {
    setFormValues(current => ({ ...current, ...patch }))
    if (patch.name !== undefined) setNameEdited(true)
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
  const isBusy = isCreating || isUploadingApk || isPreparingIcon
  const destinations = parseOutboundDestinations(
    canConfigureEgress && formValues.networkPolicyEnabled ? destinationDraft : '',
    canUseInternet
  )
  const draftErrors = {
    ...validateCreateAppDraft(formValues, isRedroidRuntime && canChangeContainerArgs),
    ...(destinations.error ? { networkPolicyAllowCidrs: [destinations.error] } : {})
  }
  const isDraftInvalid = Object.keys(draftErrors).length > 0 || Object.keys(numericErrors).length > 0
  const visibleErrors: Record<string, string[]> = { ...fieldErrors, ...numericErrors, ...draftErrors }
  const fieldError = (field: string) => visibleErrors[field]?.join(' ')
  const hasFieldErrors = Object.keys(fieldErrors).length > 0

  const handleIconChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || isPreparingIcon || isCreating || loading) return

    setIsPreparingIcon(true)
    setIconError(undefined)
    try {
      setManualIconPreview(await optimizeIconFile(file))
    } catch (error) {
      setIconError(getDisplayErrorMessage(error, 'Choose a different image.'))
    } finally {
      setIsPreparingIcon(false)
    }
  }

  const handleClearIcon = () => {
    setIconError(undefined)
    setManualIconPreview(null)
  }

  const handleApkSelect = async (file: File | null) => {
    if (!file || isUploadingApk || isCreating || loading) return

    setApkUploadError(undefined)
    clearFieldErrors('uploadedApkId')
    setPendingApkName(file.name)

    try {
      const uploaded = await uploadApkWithFeedback({
        errorTitle: 'Could not upload APK',
        file,
        maxApkUploadSizeMb: settings.maxApkUploadSizeMb,
        topLoader,
        onError: setApkUploadError
      })
      if (!uploaded) return

      setUploadedApk(uploaded)
      if (!nameInput.current?.value.trim()) {
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
      setPendingApkName(null)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isBusy || submitting.current || loading) return

    const submissionErrors = { ...draftErrors, ...validateCreateAppNumericFields(event.currentTarget) }
    setFieldErrors(submissionErrors)
    if (Object.keys(submissionErrors).length > 0) {
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
          values: { ...formValues, networkPolicyAllowCidrs: destinations.cidrs ?? formValues.networkPolicyAllowCidrs }
        })
      )

      if (!isActionResult(result)) throw new Error('Invalid create-app action result')
      if (!result.ok) {
        topLoader.done(true)
        const errors = result.error.fieldErrors ?? {}
        setFailure({ ...result.error, hasFieldErrors: Object.keys(errors).length > 0, focusName: Boolean(errors.name) })
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
      <CompactPageHeader
        section={{ label: 'Apps', href: '/apps' }}
        title='Create app'
        description='Set up an Android app and its runtime.'
        actions={
          <MutationButton
            form={createFormId}
            type='submit'
            pending={isCreating}
            pendingLabel='Creating…'
            disabled={loading || isBusy || isDraftInvalid}
            className={cn(compactPageActionClassName, 'max-sm:px-3')}
          >
            <span className='inline-flex sm:hidden'>
              <IconPlus
                aria-hidden
                className='size-4'
              />
            </span>
            Create app
          </MutationButton>
        }
      />
      <PageContent>
        <form
          ref={form}
          id={createFormId}
          className='w-full'
          noValidate
          onInput={event => {
            if (event.target instanceof HTMLInputElement && event.target.type === 'number') {
              setNumericErrors(validateCreateAppNumericFields(event.currentTarget))
            }
          }}
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
                pendingApkName={pendingApkName}
                isUploadingApk={isUploadingApk}
                disabled={loading || isCreating}
                nameError={nameEdited || formValues.name || fieldErrors.name ? fieldError('name') : undefined}
                nameInputRef={nameInput}
                apkError={apkUploadError ?? fieldError('uploadedApkId')}
                onApkSelect={file => void handleApkSelect(file)}
                iconSlot={
                  <AppIconField
                    appName={trimmedName}
                    iconPreview={iconPreview}
                    autoExtractIcon={!manualIconPreview && autoExtractIcon}
                    disabled={loading || isCreating}
                    pending={isPreparingIcon}
                    error={iconError}
                    onIconChange={event => void handleIconChange(event)}
                    onClearIcon={manualIconPreview ? handleClearIcon : undefined}
                    onAutoExtractIconChange={
                      extractedIcon && !manualIconPreview
                        ? checked => {
                            setIconError(undefined)
                            setAutoExtractIcon(checked)
                          }
                        : undefined
                    }
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
                    displayFieldErrors={visibleErrors}
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
                <AppNetworkPolicyEditorSection
                  restricted={formValues.networkPolicyEnabled}
                  onRestrictedChange={networkPolicyEnabled => updateFormValues({ networkPolicyEnabled })}
                  destinations={destinationDraft}
                  onDestinationsChange={text => {
                    setDestinationDraft(text)
                    clearFieldErrors('networkPolicyAllowCidrs')
                  }}
                  canUseInternet={canUseInternet}
                  disabled={loading || isCreating}
                  modeError={fieldError('networkPolicyEnabled')}
                  destinationsError={fieldError('networkPolicyAllowCidrs')}
                />
              </div>
            </Visible>

            <Visible when={showAdvancedSection}>
              <Section surface='plain'>
                <Section
                  surface='plain'
                  title='Lifecycle and resources'
                  headingSpacing='compact'
                  collapsible
                  summary={showResourcesSection ? resourceSummary : undefined}
                >
                  <AppLifecycleFields
                    values={formValues}
                    resourceLimits={resourceLimits}
                    showSession={showSessionSection}
                    showResources={showResourcesSection}
                    onChange={updateFormValues}
                    errors={{
                      inactivityTimeoutSeconds: fieldError('inactivityTimeoutSeconds'),
                      memoryLimitMb: fieldError('memoryLimitMb'),
                      cpuLimitCpus: fieldError('cpuLimitCpus')
                    }}
                  />
                </Section>
              </Section>
            </Visible>
          </CreateAppLayout>
        </form>
      </PageContent>
    </>
  )
}
