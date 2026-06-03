import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useTopLoader } from 'nextjs-toploader'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { uploadApkWithFeedback } from '@/features/applications/apks/upload-apk-with-feedback'
import { Setting } from '@/features/settings/components/setting'
import { useOrchestratorUiSettings } from '@/features/settings/hooks/use-orchestrator-ui-settings'
import { toast } from '@/hooks/use-toast'
import { updateApkAction } from '@/server/orchestrator/applications/actions/configuration/create-update-actions'
import type { AppFormValues } from '@/features/applications/create/create-app-form.types'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { OrchestratorUiSettings } from '@/features/settings/hooks/use-orchestrator-ui-settings'

type AppManageGeneralSettingsProps = {
  app?: AppDefinition
  appId: string
  values: AppFormValues
  initialSettings: OrchestratorUiSettings
  iconSlot?: ReactNode
  onAppNameChange: (value: string) => void
}

const verticalSettingClassName = 'flex-col items-start w-full'

export const AppManageGeneralSettings = ({
  app,
  appId,
  values,
  initialSettings,
  iconSlot,
  onAppNameChange
}: AppManageGeneralSettingsProps) => {
  const [isUploadingApk, setIsUploadingApk] = useState(false)
  const settings = useOrchestratorUiSettings(initialSettings, { refreshOnMount: false })
  const router = useRouter()
  const topLoader = useTopLoader()

  const handleApkUpload = async (file: File | null) => {
    if (!file) return

    setIsUploadingApk(true)

    try {
      const uploaded = await uploadApkWithFeedback({
        errorTitle: 'Could not upload APK',
        file,
        maxApkUploadSizeMb: settings.maxApkUploadSizeMb,
        topLoader
      })
      if (!uploaded) return

      await updateApkAction(appId, uploaded.id)
      toast({ title: 'APK uploaded' })
      router.refresh()
    } finally {
      setIsUploadingApk(false)
    }
  }

  return (
    <Section
      title='Application'
      boxed
      titleClassName='pb-4'
      contentClassName='gap-5'
    >
      <div className='grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]'>
        <div className='grid gap-4'>
          <Setting
            label='Name'
            description='Display name shown in the UI for this app. Minimum 2 characters.'
            variant='vertical'
            className={verticalSettingClassName}
            required
          >
            <Input
              value={values.name}
              required
              aria-required='true'
              minLength={2}
              onChange={event => onAppNameChange(event.target.value)}
            />
          </Setting>
          <Setting
            label='APK file'
            description='Upload a replacement Android package when app metadata or binaries need to change.'
            variant='vertical'
            className={verticalSettingClassName}
          >
            <div className='flex w-full flex-col gap-2'>
              <Input
                type='file'
                accept='.apk,application/vnd.android.package-archive'
                disabled={isUploadingApk}
                onChange={event => {
                  void handleApkUpload(event.target.files?.[0] ?? null)
                  event.target.value = ''
                }}
              />
              <p className='text-sm text-secondary-foreground'>
                {app?.apkOriginalName ? `Current APK: ${app.apkOriginalName}` : 'No APK uploaded'}
              </p>
            </div>
          </Setting>
        </div>
        <Visible when={iconSlot}>
          <div className='border-border/60 xl:border-l xl:pl-5'>{iconSlot}</div>
        </Visible>
      </div>
    </Section>
  )
}
