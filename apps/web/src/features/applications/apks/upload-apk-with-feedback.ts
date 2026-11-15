import { uploadApkWithProgress } from '@/features/applications/apks/upload'
import { toast } from '@/hooks/use-toast'
import { apkSizeLabel, isFileWithinApkLimit } from '@/shared/model/settings/use-orchestrator-ui-settings'
import type { UploadedApk } from '@/shared/contracts/application'

type UploadApkWithFeedbackOptions = {
  errorTitle: string
  file: File
  maxApkUploadSizeMb: number
  onProgress?: (progress: number) => void
  onError?: (message: string) => void
}

export const uploadApkWithFeedback = async ({
  errorTitle,
  file,
  maxApkUploadSizeMb,
  onProgress,
  onError
}: UploadApkWithFeedbackOptions): Promise<UploadedApk | null> => {
  if (!isFileWithinApkLimit(file, maxApkUploadSizeMb)) {
    const description = `The configured upload limit is ${apkSizeLabel(maxApkUploadSizeMb)}.`
    if (onError) onError(`APK is too large. ${description}`)
    else toast({ title: 'APK is too large', description, variant: 'danger' })
    return null
  }

  try {
    return await uploadApkWithProgress({ file, onProgress })
  } catch (error) {
    const description = error instanceof Error ? error.message : 'Try uploading the APK again.'
    if (onError) onError(description)
    else toast({ title: errorTitle, description, variant: 'danger' })
    return null
  }
}
