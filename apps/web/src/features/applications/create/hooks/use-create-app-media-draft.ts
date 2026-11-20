import { useState, type ChangeEvent } from 'react'
import { uploadApkWithFeedback } from '@/features/applications/apks/upload-apk-with-feedback'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { optimizeIconFile } from '@/shared/model/media/icon-metadata'
import type { UploadedApk } from '@/shared/contracts/application'

export function useCreateAppMediaDraft({
  initialUploadedApk,
  maxApkUploadSizeMb,
  disabled,
  canUploadApk,
  clearApkFieldError,
  onApkApplied
}: {
  initialUploadedApk?: UploadedApk | null
  maxApkUploadSizeMb: number
  disabled: boolean
  canUploadApk: boolean
  clearApkFieldError: () => void
  onApkApplied: (apk: UploadedApk) => void
}) {
  const [uploadedApk, setUploadedApk] = useState<UploadedApk | null>(initialUploadedApk ?? null)
  const [pendingApkName, setPendingApkName] = useState<string | null>(null)
  const [apkUploadProgress, setApkUploadProgress] = useState<number | null>(null)
  const [apkError, setApkError] = useState<string>()
  const [manualIconPreview, setManualIconPreview] = useState<string | null>(null)
  const [isPreparingIcon, setIsPreparingIcon] = useState(false)
  const [iconError, setIconError] = useState<string>()
  const [autoExtractIcon, setAutoExtractIcon] = useState(true)
  const isUploadingApk = pendingApkName !== null
  const extractedIcon = uploadedApk?.extractedIconDataUrl ?? null
  const iconPreview = manualIconPreview ?? (autoExtractIcon ? extractedIcon : null)

  const applyApk = (apk: UploadedApk | null) => {
    setApkError(undefined)
    clearApkFieldError()
    setUploadedApk(apk)
    if (apk) onApkApplied(apk)
  }

  const uploadApk = async (file: File | null) => {
    if (!file || isUploadingApk || disabled || !canUploadApk) return

    setApkError(undefined)
    clearApkFieldError()
    setPendingApkName(file.name)
    try {
      const uploaded = await uploadApkWithFeedback({
        errorTitle: 'Could not upload APK',
        file,
        maxApkUploadSizeMb,
        onProgress: setApkUploadProgress,
        onError: setApkError
      })
      if (!uploaded) return

      applyApk(uploaded)
      toast({
        title: 'APK uploaded',
        description: uploaded.extractedIconDataUrl
          ? 'Launcher icon was extracted.'
          : 'No direct launcher icon was found in the APK.',
        variant: 'success'
      })
    } finally {
      setPendingApkName(null)
      setApkUploadProgress(null)
    }
  }

  const prepareIcon = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || isPreparingIcon || disabled) return

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

  const clearIcon = () => {
    setIconError(undefined)
    setManualIconPreview(null)
  }

  const changeAutoExtractIcon = (checked: boolean) => {
    setIconError(undefined)
    setAutoExtractIcon(checked)
  }

  return {
    apk: {
      uploadedApk,
      pendingApkName,
      isUploadingApk,
      apkUploadProgress,
      apkError,
      onApkSelect: (file: File | null) => void uploadApk(file),
      onSavedApkSelect: applyApk,
      onClearApk: uploadedApk ? () => applyApk(null) : undefined,
      uploadDisabled: !canUploadApk
    },
    icon: {
      iconPreview,
      autoExtractIcon: !manualIconPreview && autoExtractIcon,
      pending: isPreparingIcon,
      error: iconError,
      onIconChange: (event: ChangeEvent<HTMLInputElement>) => void prepareIcon(event),
      onClearIcon: manualIconPreview ? clearIcon : undefined,
      onAutoExtractIconChange: extractedIcon && !manualIconPreview ? changeAutoExtractIcon : undefined
    }
  }
}
