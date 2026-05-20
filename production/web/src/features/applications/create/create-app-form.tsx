'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTopLoader } from 'nextjs-toploader'
import { CreateAppDeviceSection } from './create-app-device-section'
import { CreateAppGeneralSection } from './create-app-general-section'
import { CreateAppIconSection } from './create-app-icon-section'
import { CreateAppResourcesSection } from './create-app-resources-section'
import { CreateAppRuntimeKind } from './create-app-runtime-kind'
import { CreateAppSessionSection } from './create-app-session-section'
import type { CreateAppFormValues } from './create-app-form.types'
import type { OrchestratorUiSettings } from '@/features/settings/hooks/use-orchestrator-ui-settings'
import type { UploadedApk } from '@/server/orchestrator/applications/types'
import { Button } from '@/components/ui/button'
import { Visible } from '@/components/ui/visible'
import { uploadApkWithProgress } from '@/features/applications/apks/upload'
import { optimizeIconFile } from '@/features/applications/icons/icon-metadata'
import {
  apkSizeLabel,
  isFileWithinApkLimit,
  useOrchestratorUiSettings
} from '@/features/settings/hooks/use-orchestrator-ui-settings'
import { PageBackdrop } from '@/features/shell/components/page-backdrop'
import { PageBreadcrumbs } from '@/features/shell/components/page-breadcrumbs'
import { toast } from '@/hooks/use-toast'
import { setAppIconAction } from '@/server/app-icons/actions/set-app-icon-action'
import { createApplicationAction } from '@/server/orchestrator/applications/mutation-actions'
import { hasPermission, isRedroidImage, type PermissionMap } from '@/shared/permissions/permissions'
import { applyRedroidDefaultContainerArgs } from '@/shared/runtime/redroid-runtime'

const getInitialFormValues = (settings: OrchestratorUiSettings): CreateAppFormValues => ({
  name: '',
  containerImage: settings.defaultContainerImage,
  inactivityTimeoutSeconds: settings.defaultInactivityTimeoutSeconds,
  memoryLimitMb: '',
  cpuLimitCpus: '',
  volumeSizeLimitMb: '',
  customContainerArgs: '',
  redroidExtraArgs: ''
})

export const CreateAppForm = ({
  initialSettings,
  permissions
}: {
  initialSettings: OrchestratorUiSettings
  permissions: PermissionMap
}) => {
  const topLoader = useTopLoader()
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
  const isSubmitDisabled = isCreating || isUploadingApk || trimmedName.length < 2

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
      const uploaded = await uploadApkWithProgress({
        file,
        onProgress: progress => {
          topLoader.setProgress(Math.min(Math.max(progress / 100, 0.08), 0.95))
        }
      })
      topLoader.setProgress(1)
      setUploadedApk(uploaded)

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

    setIsCreating(true)
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
          ? applyRedroidDefaultContainerArgs(
              formValues.containerImage,
              isRedroidRuntime ? formValues.redroidExtraArgs : formValues.customContainerArgs
            ) || undefined
          : undefined,
        uploadedApkId: uploadedApk?.id
      })

      if (iconPreview) {
        await setAppIconAction(createdApp.id, iconPreview)
      }

      toast({ title: 'App created', description: 'Provisioning has started.' })
      router.push(`/app/${createdApp.id}`)
    } catch (error) {
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
        <PageBreadcrumbs items={[{ label: 'Apps', href: '/apps' }, { label: `Create ${formValues.name.trim()}` }]} />
        <Button
          type='submit'
          disabled={isSubmitDisabled}
        >
          Create
        </Button>
      </div>
      <Visible when={iconPreview}>
        <PageBackdrop imageSrc={iconPreview} />
      </Visible>
      <form
        className='grid w-full grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)] items-start gap-6 pt-2 pb-24 max-lg:grid-cols-1'
        onSubmit={event => void handleSubmit(event)}
      >
        <div className='flex w-full flex-col gap-5'>
          <CreateAppGeneralSection
            values={formValues}
            onChange={updateFormValues}
            uploadedApk={uploadedApk}
            isUploadingApk={isUploadingApk}
            onApkSelect={file => void handleApkSelect(file)}
          />
          <CreateAppRuntimeKind isRedroidRuntime={isRedroidRuntime} />
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
              onChange={updateFormValues}
            />
          </Visible>
        </div>
        <div className='flex w-full flex-col gap-4'>
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
