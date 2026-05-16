'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageBreadcrumbs } from '@/app/(protected)/_components/page-breadcrumbs'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { setAppIconAction } from '@/lib/app-icons/actions'
import { createApplicationAction } from '@/lib/orchestrator/actions'
import { optimizeIconFile } from '@/lib/orchestrator/icon-metadata'
import { apkSizeLabel, isFileWithinApkLimit, useOrchestratorUiSettings } from '@/lib/orchestrator/settings'
import { CreateAppDeviceSection } from './create-app-device-section'
import { CreateAppGeneralSection } from './create-app-general-section'
import { CreateAppIconSection } from './create-app-icon-section'
import { CreateAppResourcesSection } from './create-app-resources-section'
import type { CreateAppFormValues } from './create-app-form.types'
import type { OrchestratorUiSettings } from '@/lib/orchestrator/settings'

const getInitialFormValues = (settings: OrchestratorUiSettings): CreateAppFormValues => ({
  name: '',
  redroidImage: settings.defaultRedroidImage,
  inactivityTimeoutSeconds: settings.defaultInactivityTimeoutSeconds,
  memoryLimitMb: '',
  cpuLimitCpus: '',
  volumeSizeLimitMb: '',
  redroidArgs: ''
})

export const CreateAppForm = ({ initialSettings }: { initialSettings: OrchestratorUiSettings }) => {
  const settings = useOrchestratorUiSettings(initialSettings, { refreshOnMount: false })
  const [formValues, setFormValues] = useState<CreateAppFormValues>(() => getInitialFormValues(settings))
  const [apk, setApk] = useState<File | null>(null)
  const [iconFile, setIconFile] = useState<File | null>(null)
  const [iconPreview, setIconPreview] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setFormValues(current => ({
      ...current,
      redroidImage: settings.defaultRedroidImage,
      inactivityTimeoutSeconds: settings.defaultInactivityTimeoutSeconds
    }))
  }, [settings.defaultInactivityTimeoutSeconds, settings.defaultRedroidImage])

  const updateFormValues = (patch: Partial<CreateAppFormValues>) => {
    setFormValues(current => ({ ...current, ...patch }))
  }

  const trimmedName = formValues.name.trim()
  const isSubmitDisabled = isCreating || trimmedName.length < 2

  const handleIconChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setIconFile(file)

    if (!file) {
      setIconPreview(null)
      return
    }

    try {
      setIconPreview(await optimizeIconFile(file))
    } catch (error) {
      toast({ title: 'Could not prepare icon', description: error instanceof Error ? error.message : 'Unknown error' })
    }
  }

  const handleClearIcon = () => {
    setIconFile(null)
    setIconPreview(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (apk && !isFileWithinApkLimit(apk, settings.maxApkUploadSizeMb)) {
      toast({
        title: 'APK is too large',
        description: `The configured upload limit is ${apkSizeLabel(settings.maxApkUploadSizeMb)}.`
      })
      return
    }

    setIsCreating(true)
    try {
      const body = new FormData()
      body.set('name', trimmedName)
      body.set('ownerUserId', settings.ownerUserId)
      if (formValues.redroidImage.trim()) body.set('redroidImage', formValues.redroidImage.trim())
      if (formValues.inactivityTimeoutSeconds) {
        body.set('inactivityTimeoutSeconds', String(formValues.inactivityTimeoutSeconds))
      }
      if (formValues.memoryLimitMb) body.set('memoryLimitMb', formValues.memoryLimitMb)
      if (formValues.cpuLimitCpus) body.set('cpuLimitCpus', formValues.cpuLimitCpus)
      if (formValues.volumeSizeLimitMb) body.set('volumeSizeLimitMb', formValues.volumeSizeLimitMb)
      if (formValues.redroidArgs.trim()) body.set('redroidArgs', formValues.redroidArgs.trim())
      if (apk) body.set('apk', apk)

      const createdApp = await createApplicationAction(body)

      if (iconFile && iconPreview) {
        await setAppIconAction(createdApp.id, iconPreview)
      }

      toast({ title: 'App created', description: 'Provisioning has started.' })
      router.push(`/app/${createdApp.id}/manage`)
    } catch (error) {
      toast({ title: 'Could not create app', description: error instanceof Error ? error.message : 'Unknown error' })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <>
      <div className='flex gap-2 flex-col'>
        <PageBreadcrumbs items={[{ label: 'Apps', href: '/apps' }, { label: 'Create' }]} />
        <h2 className='text-3xl max-sm:text-xl font-medium shrink-0 pt-4'>
          {formValues.name ? formValues.name.trim() : 'Create App'}
        </h2>
      </div>
      {iconPreview && (
        <div
          aria-hidden='true'
          className='w-screen h-screen bg-primary/80 blur-3xl fixed top-0 left-0 -z-10 pointer-events-none'
          style={{
            backgroundImage: `url("${iconPreview}")`,
            backgroundSize: '1000% 1000%',
            backgroundPosition: 'top left',
            opacity: 0.05
          }}
        />
      )}
      <form
        className='w-full flex items-start gap-8 pt-2 pb-24 max-md:flex-col'
        onSubmit={event => void handleSubmit(event)}
      >
        <div className='flex flex-col gap-5 flex-3/5 w-full'>
          <CreateAppGeneralSection
            values={formValues}
            onChange={updateFormValues}
            onApkChange={setApk}
          />
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
        <div className='shrink-0 flex flex-col gap-4 grow-0 flex-2/5 items-center max-md:w-full'>
          <CreateAppIconSection
            appName={trimmedName}
            iconPreview={iconPreview}
            onIconChange={event => void handleIconChange(event)}
            onClearIcon={handleClearIcon}
          />
        </div>
      </form>
    </>
  )
}
