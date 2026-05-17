'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTopLoader } from 'nextjs-toploader'
import { PageBreadcrumbs } from '@/app/(protected)/_components/page-breadcrumbs'
import { Button } from '@/components/ui/button'
import { Visible } from '@/components/ui/visible'
import { toast } from '@/hooks/use-toast'
import { uploadApkWithProgress } from '@/lib/apks/upload'
import { optimizeIconFile } from '@/lib/orchestrator/icon-metadata'
import { apkSizeLabel, isFileWithinApkLimit, useOrchestratorUiSettings } from '@/lib/orchestrator/settings'
import { setAppIconAction } from '@/server/app-icons/actions/set-app-icon-action'
import { createApplicationAction } from '@/server/orchestrator/applications/mutation-actions'
import { CreateAppDeviceSection } from './create-app-device-section'
import { CreateAppGeneralSection } from './create-app-general-section'
import { CreateAppIconSection } from './create-app-icon-section'
import { CreateAppResourcesSection } from './create-app-resources-section'
import type { CreateAppFormValues } from './create-app-form.types'
import type { OrchestratorUiSettings } from '@/lib/orchestrator/settings'
import type { UploadedApk } from '@/server/orchestrator/applications/types'

const getInitialFormValues = (settings: OrchestratorUiSettings): CreateAppFormValues => ({
  name: '',
  containerImage: settings.defaultContainerImage,
  inactivityTimeoutSeconds: settings.defaultInactivityTimeoutSeconds,
  memoryLimitMb: '',
  cpuLimitCpus: '',
  volumeSizeLimitMb: '',
  containerArgs: ''
})

export const CreateAppForm = ({ initialSettings }: { initialSettings: OrchestratorUiSettings }) => {
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

  useEffect(() => {
    setFormValues(current => ({
      ...current,
      containerImage: settings.defaultContainerImage,
      inactivityTimeoutSeconds: settings.defaultInactivityTimeoutSeconds
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
        containerImage: formValues.containerImage.trim() || undefined,
        inactivityTimeoutSeconds: formValues.inactivityTimeoutSeconds || undefined,
        memoryLimitMb: formValues.memoryLimitMb ? Number(formValues.memoryLimitMb) : undefined,
        cpuLimitCpus: formValues.cpuLimitCpus ? Number(formValues.cpuLimitCpus) : undefined,
        volumeSizeLimitMb: formValues.volumeSizeLimitMb ? Number(formValues.volumeSizeLimitMb) : undefined,
        containerArgs: formValues.containerArgs.trim() || undefined,
        uploadedApkId: uploadedApk?.id
      })

      if (iconPreview) {
        await setAppIconAction(createdApp.id, iconPreview)
      }

      toast({ title: 'App created', description: 'Provisioning has started.' })
      router.push(`/app/${createdApp.id}/manage`)
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
      <div className='flex gap-2 flex-col'>
        <PageBreadcrumbs items={[{ label: 'Apps', href: '/apps' }, { label: `Create ${formValues.name.trim()}` }]} />
      </div>
      <Visible when={iconPreview}>
        <div
          aria-hidden='true'
          className='w-screen h-screen bg-primary/80 blur-3xl fixed top-0 left-0 -z-10 pointer-events-none'
          style={{
            backgroundImage: iconPreview ? `url("${iconPreview}")` : undefined,
            backgroundSize: '1000% 1000%',
            backgroundPosition: 'top left',
            opacity: 0.05
          }}
        />
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
          <h2 className='font-bold'>Advanced</h2>
          <CreateAppDeviceSection
            values={formValues}
            onChange={updateFormValues}
          />
          <CreateAppResourcesSection
            values={formValues}
            onChange={updateFormValues}
          />
          <Button
            type='submit'
            disabled={isSubmitDisabled}
            className='w-full'
          >
            Create
          </Button>
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
