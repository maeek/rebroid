'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import type { DragEvent } from 'react'
import { IconDownload, IconFileDownload, IconFolderUp, IconLoader2, IconRefresh, IconUpload } from '@tabler/icons-react'
import classNames from 'classnames'
import { useTopLoader } from 'nextjs-toploader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import {
  downloadApplicationFileAction,
  listApplicationDownloadFilesAction
} from '@/server/orchestrator/applications/read-actions'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import { downloadDataUrl, formatBytes, runtimeActionErrorToast } from './runtime-tools-panel.utils'
import { ToolSection } from './tool-section'
import { uploadDownloadFileWithProgress } from './upload-download-file'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ApplicationRuntimeFile } from '@/server/orchestrator/applications/types'

export const DownloadsToolsSection = ({
  app,
  permissions,
  className
}: {
  app: AppDefinition
  permissions: PermissionMap
  className?: string
}) => {
  const runtimeAvailable = app.status === 'running'
  const canTransferFiles = hasPermission(permissions, 'applications:transfer-files')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const topLoader = useTopLoader()
  const [files, setFiles] = useState<ApplicationRuntimeFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadFileName, setUploadFileName] = useState('')
  const [isRefreshingFiles, startRefreshFilesTransition] = useTransition()
  const isUploading = uploadProgress !== null

  const refreshFiles = useCallback(() => {
    if (!runtimeAvailable || !canTransferFiles) {
      return
    }

    startRefreshFilesTransition(async () => {
      try {
        setFiles(await listApplicationDownloadFilesAction(app.id))
      } catch (error) {
        runtimeActionErrorToast('Could not list files', error)
      }
    })
  }, [app.id, canTransferFiles, runtimeAvailable])

  useEffect(() => {
    refreshFiles()
  }, [refreshFiles])

  const handleFileUpload = (file: File | undefined) => {
    if (!file) {
      return
    }

    setUploadFileName(file.name)
    setUploadProgress(0)
    topLoader.start()
    topLoader.setProgress(0.08)

    uploadDownloadFileWithProgress({
      appId: app.id,
      file,
      onProgress: progress => {
        setUploadProgress(progress)
        topLoader.setProgress(Math.min(Math.max(progress / 100, 0.08), 0.95))
      }
    })
      .then(() => {
        topLoader.setProgress(1)
        toast({ title: 'File uploaded', description: `${file.name} is available in Files.` })
        refreshFiles()
      })
      .catch(error => {
        runtimeActionErrorToast('Could not upload file', error)
      })
      .finally(() => {
        topLoader.done(true)
        setUploadProgress(null)
        setUploadFileName('')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      })
  }

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setIsDragging(false)
    if (!runtimeAvailable || isUploading) {
      return
    }

    handleFileUpload(event.dataTransfer.files?.[0])
  }

  const handleDownload = (fileName: string) => {
    startRefreshFilesTransition(async () => {
      try {
        const file = await downloadApplicationFileAction(app.id, fileName)
        downloadDataUrl(file.dataUrl, file.name)
      } catch (error) {
        runtimeActionErrorToast('Could not download file', error)
      }
    })
  }

  if (!canTransferFiles) {
    return null
  }

  return (
    <ToolSection
      title='Files'
      description='Upload files into the runtime Download folder and fetch generated files back.'
      icon={<IconFileDownload className='size-5' />}
      className={className}
      actions={
        <>
          <Button
            type='button'
            size='sm'
            variant='secondary'
            disabled={!runtimeAvailable || isRefreshingFiles}
            onClick={refreshFiles}
          >
            {isRefreshingFiles ? <IconLoader2 className='size-4 animate-spin' /> : <IconRefresh className='size-4' />}
            Refresh
          </Button>
          <Button
            type='button'
            size='sm'
            disabled={!runtimeAvailable || isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? <IconLoader2 className='size-4 animate-spin' /> : <IconUpload className='size-4' />}
            Upload
          </Button>
          <Input
            ref={fileInputRef}
            type='file'
            className='hidden'
            onChange={event => handleFileUpload(event.target.files?.[0])}
          />
        </>
      }
    >
      <div className='grid gap-4'>
        <button
          type='button'
          disabled={!runtimeAvailable || isUploading}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={event => {
            event.preventDefault()
            if (runtimeAvailable) {
              setIsDragging(true)
            }
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={classNames(
            // eslint-disable-next-line max-len
            `flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition`,
            {
              'border-primary/70 bg-primary/10 text-foreground': isDragging,
              'border-border/70 bg-background/25 text-secondary-foreground': !isDragging,
              'cursor-not-allowed opacity-60': !runtimeAvailable,
              'hover:border-primary/55 hover:bg-background/35': runtimeAvailable
            }
          )}
        >
          {isUploading ? <IconLoader2 className='size-6 animate-spin' /> : <IconFolderUp className='size-6' />}
          <span className='font-medium text-foreground'>
            {isUploading
              ? `Uploading ${uploadFileName || 'file'}${uploadProgress === null ? '' : ` (${uploadProgress}%)`}`
              : runtimeAvailable
                ? 'Drop a file here or choose one'
                : 'Start the app to transfer files'}
          </span>
          <span className='text-xs'>Files are copied to the Android Download folder.</span>
        </button>

        {files.length === 0 ? (
          <div className='rounded-md bg-background/25 px-4 py-5 text-center text-sm text-secondary-foreground'>
            {runtimeAvailable ? 'No files yet.' : 'Start the app to browse files.'}
          </div>
        ) : (
          <div className='divide-y divide-border/55 overflow-hidden rounded-md bg-background/25'>
            {files.map(file => (
              <div
                key={file.path}
                className='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-sm max-sm:grid-cols-1'
              >
                <div className='min-w-0'>
                  <div className='truncate font-medium'>{file.name}</div>
                  <div className='text-xs text-secondary-foreground'>
                    {formatBytes(file.sizeBytes)}
                    {file.modifiedAt ? ` • ${new Date(file.modifiedAt).toLocaleString()}` : ''}
                  </div>
                </div>
                <Button
                  type='button'
                  size='sm'
                  variant='secondary'
                  disabled={!runtimeAvailable}
                  onClick={() => handleDownload(file.name)}
                >
                  <IconDownload className='size-4' />
                  Download
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </ToolSection>
  )
}
