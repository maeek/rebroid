import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useTopLoader } from 'nextjs-toploader'
import { toast } from '@/hooks/use-toast'
import {
  downloadApplicationRuntimeFileAction,
  listApplicationFilesAction
} from '@/server/orchestrator/applications/actions/runtime/file-actions'
import { downloadDataUrl, runtimeActionErrorToast } from '../runtime-tools-panel.utils'
import { runtimeFilesRootPath, topLoaderProgressForUpload, type BrowserView } from './downloads-tools-section-model'
import { uploadDownloadFileWithProgress } from './upload-download-file'
import type { ApplicationRuntimeFile } from '@/server/orchestrator/applications/types'

export const useRuntimeFileBrowser = ({
  appId,
  canTransferFiles,
  runtimeAvailable
}: {
  appId: string
  canTransferFiles: boolean
  runtimeAvailable: boolean
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const topLoader = useTopLoader()
  const [currentPath, setCurrentPath] = useState(runtimeFilesRootPath)
  const [files, setFiles] = useState<ApplicationRuntimeFile[]>([])
  const [view, setView] = useState<BrowserView>('list')
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadFileName, setUploadFileName] = useState('')
  const [isRefreshingFiles, startRefreshFilesTransition] = useTransition()
  const isUploading = uploadProgress !== null

  const refreshFiles = useCallback(
    (options: { notifyOnError?: boolean } = {}) => {
      if (!runtimeAvailable || !canTransferFiles) return
      startRefreshFilesTransition(async () => {
        try {
          setFiles(await listApplicationFilesAction(appId, currentPath))
        } catch (error) {
          setFiles([])
          if (options.notifyOnError) runtimeActionErrorToast('Could not list files', error)
        }
      })
    },
    [appId, canTransferFiles, currentPath, runtimeAvailable]
  )

  useEffect(() => {
    setCurrentPath(runtimeFilesRootPath)
  }, [appId])

  useEffect(() => {
    if (!runtimeAvailable) {
      setFiles([])
      return
    }
    refreshFiles()
  }, [refreshFiles, runtimeAvailable])

  const handleFileUpload = (file: File | undefined) => {
    if (!file || !runtimeAvailable) return
    setUploadFileName(file.name)
    setUploadProgress(0)
    topLoader.start()
    topLoader.setProgress(0.08)
    uploadDownloadFileWithProgress({
      appId,
      file,
      path: currentPath,
      onProgress: progress => {
        setUploadProgress(progress)
        topLoader.setProgress(topLoaderProgressForUpload(progress))
      }
    })
      .then(() => {
        topLoader.setProgress(1)
        toast({ title: 'File uploaded', description: `${file.name} is available in ${currentPath}.` })
        refreshFiles()
      })
      .catch(error => runtimeActionErrorToast('Could not upload file', error))
      .finally(() => {
        topLoader.done(true)
        setUploadProgress(null)
        setUploadFileName('')
        if (fileInputRef.current) fileInputRef.current.value = ''
      })
  }

  const handleDownload = (file: ApplicationRuntimeFile) => {
    startRefreshFilesTransition(async () => {
      try {
        const download = await downloadApplicationRuntimeFileAction(appId, file.path)
        downloadDataUrl(download.dataUrl, download.name)
      } catch (error) {
        runtimeActionErrorToast('Could not download file', error)
      }
    })
  }

  return {
    currentPath,
    fileInputRef,
    files,
    handleDownload,
    handleFileUpload,
    isRefreshingFiles,
    isUploading,
    refreshFiles,
    setCurrentPath,
    setView,
    uploadFileName,
    uploadProgress,
    view
  }
}
