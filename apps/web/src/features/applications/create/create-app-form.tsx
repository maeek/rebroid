'use client'

import { FormEvent, useEffect, useId, useRef, useState } from 'react'
import { IconPlus } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useTopLoader } from 'nextjs-toploader'
import { Button } from '@/components/ui/button'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { AppIconField } from '@/features/applications/components/app-icon-field'
import { AppLifecycleFields } from '@/features/applications/components/app-lifecycle-fields'
import { AppNetworkPolicyEditorSection } from '@/features/applications/components/app-network-policy-editor-section'
import { parseOutboundDestinations } from '@/features/applications/components/outbound-destinations'
import { useAppRuntimeValidation } from '@/features/applications/hooks/use-app-runtime-validation'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { sendBff } from '@/lib/http/bff'
import { cn } from '@/lib/utils'
import { submitCreateApplicationAction } from '@/server/orchestrator/applications/actions/configuration/create-update-actions'
import { isActionResult } from '@/shared/actions/action-result'
import { unconfirmedAppCreationMessage } from '@/shared/contracts/application'
import { isApplicationId } from '@/shared/model/application-id'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import {
  findPlatformImageByReference,
  resolvePlatformImageRuntimeMetadata,
  runtimeKindForImageReference
} from '@/shared/model/runtime-image/runtime-image-metadata'
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
  validateCreateAppDraft
} from './create-app-form-model'
import { AppFormGeneralSection } from './create-app-general-section'
import { CreateAppGooglePlayGuidance } from './create-app-google-play-guidance'
import { CreateAppLayout } from './create-app-layout'
import { useCreateAppMediaDraft } from './hooks/use-create-app-media-draft'
import type { CreateAppFormValues } from './create-app-form.types'
import type { UploadedApk } from '@/shared/contracts/application'
import type { PlatformImage } from '@/shared/contracts/platform'
import type { OrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

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
  const settings = useOrchestratorUiSettings(initialSettings)
  const [formValues, setFormValues] = useState<CreateAppFormValues>(() => {
    const initial = getInitialCreateAppFormValues(settings)
    return {
      ...initial,
      name: initialUploadedApk ? appNameFromApk(initialUploadedApk.originalName, initialUploadedApk) : initial.name,
      containerImage: initialContainerImage?.trim() || settings.defaultContainerImage
    }
  })
  const [creationPhase, setCreationPhase] = useState<'idle' | 'creating' | 'opening'>('idle')
  const isCreating = creationPhase !== 'idle'
  const [nameEdited, setNameEdited] = useState(false)
  const [destinationDraft, setDestinationDraft] = useState('')
  const [failure, setFailure] = useState<{
    message: string
    requestId?: string
    hasFieldErrors?: boolean
    focusName?: boolean
  } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const submitting = useRef(false)
  const form = useRef<HTMLFormElement>(null)
  const failureSummary = useRef<HTMLDivElement>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const canChangeBaseImage = hasPermission(permissions, 'applications:change-base-image')
  const canChangeSessionLimit = hasPermission(permissions, 'applications:change-session-limit')
  const canChangeResources = hasPermission(permissions, 'applications:change-resources')
  const canChangeContainerArgs = hasPermission(permissions, 'applications:change-container-args')
  const { isFeatureEnabled } = useFeatureFlags()
  const canConfigureEgress =
    isFeatureEnabled('feature.firewall') && hasPermission(permissions, 'applications:configure-egress')
  const canUseInternet = hasPermission(permissions, 'applications:use-internet')
  const selectedImage = findPlatformImageByReference(images, formValues.containerImage)
  const selectedImageMetadata = selectedImage ? resolvePlatformImageRuntimeMetadata(selectedImage).metadata : null
  const runtimeKind =
    selectedImageMetadata?.runtimeKind ?? runtimeKindForImageReference(images, formValues.containerImage)
  const isRedroidRuntime = runtimeKind === 'redroid'
  const imageIncludesGooglePlay = selectedImageMetadata?.gmsMode === 'gapps'
  const showDeviceSection = canChangeBaseImage || canChangeContainerArgs
  const showSessionSection = canChangeSessionLimit
  const showResourcesSection = canChangeResources
  const showAdvancedSection = showSessionSection || showResourcesSection
  const resourceSummary =
    formValues.memoryLimitMb || formValues.cpuLimitCpus ? 'Custom RAM or CPU limits' : 'Default RAM and CPU limits'
  const resourceLimits = useResourceLimitBounds(showResourcesSection && !loading)
  const runtimeValidation = useAppRuntimeValidation(
    form,
    formValues,
    {
      inactivityTimeoutSeconds: showSessionSection && !loading,
      memoryLimitMb: showResourcesSection && !loading,
      cpuLimitCpus: showResourcesSection && !loading
    },
    resourceLimits
  )
  const customDisplayConfig =
    formValues.redroidDisplayProfileId === 'custom' ? getCustomDisplayConfig(formValues) : undefined

  useEffect(() => {
    setFormValues(current => ({
      ...current,
      containerImage: initialContainerImage?.trim() || settings.defaultContainerImage,
      inactivityTimeoutSeconds: String(settings.defaultInactivityTimeoutSeconds),
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

  const { apk, icon } = useCreateAppMediaDraft({
    initialUploadedApk,
    maxApkUploadSizeMb: settings.maxApkUploadSizeMb,
    disabled: loading || isCreating,
    canUploadApk: hasPermission(permissions, 'applications:upload-apk'),
    clearApkFieldError: () => clearFieldErrors('uploadedApkId'),
    onApkApplied: selectedApk => {
      if (!nameInput.current?.value.trim()) {
        updateFormValues({ name: appNameFromApk(selectedApk.originalName, selectedApk) })
      }
    }
  })
  const { uploadedApk } = apk
  const { iconPreview } = icon
  const showGooglePlayGuidance = uploadedApk !== null && !imageIncludesGooglePlay
  const showRuntimeSection = showDeviceSection || showGooglePlayGuidance
  const trimmedName = formValues.name.trim()
  const isBusy = isCreating || apk.isUploadingApk || icon.pending
  const destinations = parseOutboundDestinations(
    canConfigureEgress && formValues.networkPolicyEnabled ? destinationDraft : '',
    canUseInternet
  )
  const draftErrors = {
    ...validateCreateAppDraft(formValues, isRedroidRuntime && canChangeContainerArgs),
    ...(destinations.error ? { networkPolicyAllowCidrs: [destinations.error] } : {})
  }
  const isDraftInvalid = Object.keys(draftErrors).length > 0 || Object.keys(runtimeValidation.errors).length > 0
  const visibleErrors: Record<string, string[]> = { ...fieldErrors, ...draftErrors }
  const fieldError = (field: string) => visibleErrors[field]?.join(' ')
  const hasFieldErrors = Object.keys(fieldErrors).length > 0 || Object.keys(runtimeValidation.errors).length > 0

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isBusy || submitting.current || loading) return

    const runtimeErrors = runtimeValidation.validate()
    setFieldErrors(draftErrors)
    if (Object.keys(draftErrors).length > 0 || Object.keys(runtimeErrors).length > 0) {
      setFailure({ message: 'Review the highlighted fields and try again.', hasFieldErrors: true })
      return
    }

    setFailure(null)
    submitting.current = true
    setCreationPhase('creating')
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
      const destination = `/apps/${createdApp.id}`
      setCreationPhase('opening')
      topLoader.setProgress(1)
      toast({
        title: 'App creation started',
        description: iconPreview ? 'Saving the app icon in the background.' : 'Track provisioning on the app page.',
        variant: 'success'
      })
      router.push(destination)
      if (iconPreview) {
        void sendBff<string | null>(`/api/bff/devices/${createdApp.id}/icon`, { icon: iconPreview }, 'PATCH').then(
          savedIcon => {
            if (!savedIcon) return
            if (window.location.pathname === destination) router.refresh()
            toast({ title: 'App icon saved', variant: 'success' })
          },
          error => {
            toast({
              title: 'Could not save the app icon',
              description: getDisplayErrorMessage(error, 'You can add an icon from the app’s Configuration page.'),
              variant: 'danger'
            })
          }
        )
      }
    } catch {
      topLoader.done(true)
      setFailure({ message: unconfirmedAppCreationMessage })
    } finally {
      submitting.current = false
      setCreationPhase(current => (current === 'opening' ? current : 'idle'))
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
            pendingLabel={creationPhase === 'opening' ? 'Opening app…' : 'Creating…'}
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
          onInput={runtimeValidation.onInput}
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
                {...apk}
                values={formValues}
                onChange={updateFormValues}
                disabled={loading || isCreating}
                nameError={nameEdited || formValues.name || fieldErrors.name ? fieldError('name') : undefined}
                nameInputRef={nameInput}
                apkError={apk.apkError ?? fieldError('uploadedApkId')}
                iconSlot={
                  <AppIconField
                    {...icon}
                    appName={trimmedName}
                    disabled={loading || isCreating}
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
                    imageIncludesGooglePlay={!loading && imageIncludesGooglePlay}
                    imageError={fieldError('containerImage')}
                    argumentsError={fieldError('containerArgs')}
                    displayFieldErrors={visibleErrors}
                  />
                </Visible>
                {showGooglePlayGuidance ? (
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
                    disabled={isCreating}
                    resourceLimits={resourceLimits}
                    showSession={showSessionSection}
                    showResources={showResourcesSection}
                    onChange={updateFormValues}
                    errors={{
                      inactivityTimeoutSeconds:
                        runtimeValidation.errors.inactivityTimeoutSeconds ?? fieldError('inactivityTimeoutSeconds'),
                      memoryLimitMb: runtimeValidation.errors.memoryLimitMb ?? fieldError('memoryLimitMb'),
                      cpuLimitCpus: runtimeValidation.errors.cpuLimitCpus ?? fieldError('cpuLimitCpus')
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
