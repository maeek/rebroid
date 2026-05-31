'use client'

import { ChangeEvent, FormEvent, useEffect, useId, useState } from 'react'
import { IconLoader2 } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useTopLoader } from 'nextjs-toploader'
import { Button } from '@/components/ui/button'
import { Visible } from '@/components/ui/visible'
import { lookupUploadedApk, sha256File, uploadApkWithProgress } from '@/features/applications/apks/upload'
import { optimizeIconFile } from '@/features/applications/icons/icon-metadata'
import {
  apkSizeLabel,
  isFileWithinApkLimit,
  useOrchestratorUiSettings
} from '@/features/settings/hooks/use-orchestrator-ui-settings'
import { useResourceLimitBounds } from '@/features/settings/hooks/use-resource-limit-bounds'
import { PageBackdrop } from '@/features/shell/components/page-backdrop'
import { PageBreadcrumbs } from '@/features/shell/components/page-breadcrumbs'
import { toast } from '@/hooks/use-toast'
import { setAppIconAction } from '@/server/app-icons/actions/set-app-icon-action'
import { createApplicationAction } from '@/server/orchestrator/applications/mutation-actions'
import { hasPermission, isRedroidImage, type PermissionMap } from '@/shared/permissions/permissions'
import { applyRedroidDisplayContainerArgs, defaultRedroidDisplayProfileId } from '@/shared/runtime/redroid-runtime'
import { CreateAppDeviceSection } from './create-app-device-section'
import { CreateAppDisplaySection } from './create-app-display-section'
import { CreateAppGeneralSection } from './create-app-general-section'
import { CreateAppIconSection } from './create-app-icon-section'
import { CreateAppResourcesSection } from './create-app-resources-section'
import { CreateAppSessionSection } from './create-app-session-section'
import type { CreateAppFormValues } from './create-app-form.types'
import type { OrchestratorUiSettings } from '@/features/settings/hooks/use-orchestrator-ui-settings'
import type { UploadedApk } from '@/server/orchestrator/applications/types'

const getInitialFormValues = (settings: OrchestratorUiSettings): CreateAppFormValues => ({
  name: '',
  containerImage: settings.defaultContainerImage,
  inactivityTimeoutSeconds: settings.defaultInactivityTimeoutSeconds,
  memoryLimitMb: '',
  cpuLimitCpus: '',
  volumeSizeLimitMb: '',
  customContainerArgs: '',
  redroidDisplayProfileId: defaultRedroidDisplayProfileId,
  redroidCustomDisplayWidth: '1080',
  redroidCustomDisplayHeight: '2340',
  redroidCustomDisplayDpi: '440',
  redroidExtraArgs: ''
})

const appNameFromApk = (file: File, uploaded?: UploadedApk | null) =>
  uploaded?.displayName?.trim() ||
  file.name
    .replace(/\.apk$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const parseCustomDisplayValue = (value: string) => {
  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

const getCustomDisplayConfig = (values: CreateAppFormValues) => {
  const width = parseCustomDisplayValue(values.redroidCustomDisplayWidth)
  const height = parseCustomDisplayValue(values.redroidCustomDisplayHeight)
  const dpi = parseCustomDisplayValue(values.redroidCustomDisplayDpi)

  return width && height && dpi ? { width, height, dpi } : null
}

export const CreateAppForm = ({
  initialSettings,
  permissions
}: {
  initialSettings: OrchestratorUiSettings
  permissions: PermissionMap
}) => {
  const topLoader = useTopLoader()
  const createFormId = useId()
  const settings = useOrchestratorUiSettings(initialSettings, { refreshOnMount: false })
  const [formValues, setFormValues] = useState<CreateAppFormValues>(() => getInitialFormValues(settings))
  const [uploadedApk, setUploadedApk] = useState<UploadedApk | null>(null)
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
  const isRedroidRuntime = isRedroidImage(formValues.containerImage)
  const showDeviceSection = canChangeBaseImage || canChangeContainerArgs
  const showSessionSection = canChangeSessionLimit
  const showResourcesSection = canChangeResources
  const resourceLimits = useResourceLimitBounds(showResourcesSection)
  const customDisplayConfig =
    formValues.redroidDisplayProfileId === 'custom' ? getCustomDisplayConfig(formValues) : undefined

  useEffect(() => {
    setFormValues(current => ({
      ...current,
      containerImage: settings.defaultContainerImage,
      inactivityTimeoutSeconds: settings.defaultInactivityTimeoutSeconds,
      redroidExtraArgs: '',
      customContainerArgs: ''
    }))
  }, [settings.defaultInactivityTimeoutSeconds, settings.defaultContainerImage])

  const updateFormValues = (patch: Partial<CreateAppFormValues>) => {
    setFormValues(current => ({ ...current, ...patch }))
  }

  const trimmedName = formValues.name.trim()
  const isSubmitDisabled =
    isCreating ||
    isUploadingApk ||
    trimmedName.length < 2 ||
    (isRedroidRuntime &&
      canChangeContainerArgs &&
      formValues.redroidDisplayProfileId === 'custom' &&
      !customDisplayConfig)

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
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
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

    if (!isFileWithinApkLimit(file, settings.maxApkUploadSizeMb)) {
      toast({
        title: 'APK is too large',
        description: `The configured upload limit is ${apkSizeLabel(settings.maxApkUploadSizeMb)}.`,
        variant: 'destructive'
      })
      return
    }

    setIsUploadingApk(true)
    topLoader.start()
    topLoader.setProgress(0.08)

    try {
      const sha256 = await sha256File(file)
      topLoader.setProgress(0.16)
      const existing = await lookupUploadedApk(sha256)
      if (existing) {
        topLoader.setProgress(1)
        setUploadedApk(existing)
        if (!formValues.name.trim()) {
          updateFormValues({ name: appNameFromApk(file, existing) })
        }
        toast({ title: 'APK already uploaded', description: 'Using the existing upload.' })
        return
      }

      const uploaded = await uploadApkWithProgress({
        file,
        onProgress: progress => {
          topLoader.setProgress(Math.min(Math.max(progress / 100, 0.08), 0.95))
        }
      })
      topLoader.setProgress(1)
      setUploadedApk(uploaded)
      if (!formValues.name.trim()) {
        updateFormValues({ name: appNameFromApk(file, uploaded) })
      }

      if (!uploaded.extractedIconDataUrl) {
        toast({ title: 'APK uploaded', description: 'No direct launcher icon was found in the APK.' })
      } else {
        toast({ title: 'APK uploaded', description: 'Launcher icon was extracted.' })
      }
    } catch (error) {
      toast({
        title: 'Could not upload APK',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      topLoader.done(true)
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
      const createdApp = await createApplicationAction({
        name: trimmedName,
        containerImage: canChangeBaseImage ? formValues.containerImage.trim() || undefined : undefined,
        inactivityTimeoutSeconds: canChangeSessionLimit ? formValues.inactivityTimeoutSeconds || undefined : undefined,
        memoryLimitMb: canChangeResources && formValues.memoryLimitMb ? Number(formValues.memoryLimitMb) : undefined,
        cpuLimitCpus: canChangeResources && formValues.cpuLimitCpus ? Number(formValues.cpuLimitCpus) : undefined,
        volumeSizeLimitMb:
          canChangeResources && formValues.volumeSizeLimitMb ? Number(formValues.volumeSizeLimitMb) : undefined,
        containerArgs: canChangeContainerArgs
          ? (isRedroidRuntime
              ? applyRedroidDisplayContainerArgs(
                  formValues.containerImage,
                  formValues.redroidDisplayProfileId,
                  formValues.redroidExtraArgs,
                  customDisplayConfig ?? undefined
                )
              : formValues.customContainerArgs.trim()) || undefined
          : undefined,
        uploadedApkId: uploadedApk?.id
      })

      topLoader.setProgress(iconPreview ? 0.65 : 0.9)

      if (iconPreview) {
        try {
          await setAppIconAction(createdApp.id, iconPreview)
        } catch (error) {
          toast({
            title: 'App created without icon',
            description: error instanceof Error ? error.message : 'Could not save the icon.',
            variant: 'destructive'
          })
        }
      }

      topLoader.setProgress(1)
      toast({ title: 'App created', description: 'Provisioning has started.' })
      router.push(`/app/${createdApp.id}`)
    } catch (error) {
      topLoader.done(true)
      toast({
        title: 'Could not create app',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <>
      <div className='flex gap-2 justify-between items-center w-full'>
        <PageBreadcrumbs
          items={[
            { label: 'Apps', href: '/apps' },
            {
              label: `Create ${formValues.name.trim()}`
            }
          ]}
        />
        <Button
          form={createFormId}
          type='submit'
          disabled={isSubmitDisabled}
        >
          <Visible when={isCreating}>
            <IconLoader2 className='size-4 animate-spin' />
          </Visible>
          {isCreating ? 'Creating...' : 'Create'}
        </Button>
      </div>
      <Visible when={iconPreview}>
        <PageBackdrop
          imageSrc={iconPreview}
          opacity={0.08}
        />
      </Visible>
      <form
        id={createFormId}
        className='grid w-full grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)] items-start gap-6 pt-2 pb-24 max-lg:grid-cols-1'
        onSubmit={event => void handleSubmit(event)}
      >
        <div className='flex w-full flex-col gap-5'>
          <h2 className='font-bold my-4'>General</h2>
          <CreateAppGeneralSection
            values={formValues}
            onChange={updateFormValues}
            uploadedApk={uploadedApk}
            isUploadingApk={isUploadingApk}
            onApkSelect={file => void handleApkSelect(file)}
          />
          <Visible when={isRedroidRuntime && canChangeContainerArgs}>
            <CreateAppDisplaySection
              values={formValues}
              onChange={updateFormValues}
            />
          </Visible>
          <Visible when={showDeviceSection || showSessionSection || showResourcesSection}>
            <h2 className='font-bold my-4'>Advanced</h2>
          </Visible>
          <Visible when={showDeviceSection}>
            <CreateAppDeviceSection
              values={formValues}
              onChange={updateFormValues}
              canChangeBaseImage={canChangeBaseImage}
              canChangeContainerArgs={canChangeContainerArgs}
              isRedroidRuntime={isRedroidRuntime}
            />
          </Visible>
          <Visible when={showSessionSection}>
            <CreateAppSessionSection
              values={formValues}
              onChange={updateFormValues}
            />
          </Visible>
          <Visible when={showResourcesSection}>
            <CreateAppResourcesSection
              values={formValues}
              resourceLimits={resourceLimits}
              onChange={updateFormValues}
            />
          </Visible>
        </div>
        <div className='flex w-full flex-col gap-4 lg:mt-19'>
          <CreateAppIconSection
            appName={trimmedName}
            iconPreview={iconPreview}
            autoExtractIcon={autoExtractIcon}
            hasExtractedIcon={Boolean(extractedIcon)}
            onIconChange={event => void handleIconChange(event)}
            onClearIcon={handleClearIcon}
            onAutoExtractIconChange={setAutoExtractIcon}
          />
        </div>
      </form>
    </>
  )
}
