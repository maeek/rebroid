import { uploadApkWithProgress } from '@/features/applications/apks/upload'
import { toast } from '@/hooks/use-toast'
import { apkSizeLabel, isFileWithinApkLimit } from '@/shared/model/settings/use-orchestrator-ui-settings'
import type { UploadedApk } from '@/shared/contracts/application'

type TopLoader = {
  done: (force?: boolean) => void
  setProgress: (progress: number) => void
  start: () => void
}

type UploadApkWithFeedbackOptions = {
  errorTitle: string
  file: File
  maxApkUploadSizeMb: number
  topLoader: TopLoader
  onError?: (message: string) => void
}

export const uploadApkWithFeedback = async ({
  errorTitle,
  file,
  maxApkUploadSizeMb,
  topLoader,
  onError
}: UploadApkWithFeedbackOptions): Promise<UploadedApk | null> => {
  if (!isFileWithinApkLimit(file, maxApkUploadSizeMb)) {
    const description = `The configured upload limit is ${apkSizeLabel(maxApkUploadSizeMb)}.`
    if (onError) onError(`APK is too large. ${description}`)
    else toast({ title: 'APK is too large', description, variant: 'danger' })
    return null
  }

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
    return uploaded
  } catch (error) {
    const description = error instanceof Error ? error.message : 'Try uploading the APK again.'
    if (onError) onError(description)
    else toast({ title: errorTitle, description, variant: 'danger' })
    return null
  } finally {
    topLoader.done(true)
  }
}
