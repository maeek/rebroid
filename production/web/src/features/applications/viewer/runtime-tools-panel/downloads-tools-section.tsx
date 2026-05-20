'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { IconDownload, IconFileDownload, IconLoader2, IconRefresh, IconUpload } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { uploadApplicationDownloadFileAction } from '@/server/orchestrator/applications/mutation-actions'
import {
  downloadApplicationFileAction,
  listApplicationDownloadFilesAction
} from '@/server/orchestrator/applications/read-actions'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import { downloadDataUrl, formatBytes, runtimeActionErrorToast } from './runtime-tools-panel.utils'
import { ToolSection } from './tool-section'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ApplicationRuntimeFile } from '@/server/orchestrator/applications/types'

export const DownloadsToolsSection = ({ app, permissions }: { app: AppDefinition; permissions: PermissionMap }) => {
  const runtimeAvailable = app.status === 'running'
  const canTransferFiles = hasPermission(permissions, 'applications:transfer-files')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<ApplicationRuntimeFile[]>([])
  const [isRefreshingFiles, startRefreshFilesTransition] = useTransition()
  const [isUploading, startUploadTransition] = useTransition()

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

    const formData = new FormData()
    formData.append('file', file)

    startUploadTransition(async () => {
      try {
        await uploadApplicationDownloadFileAction(app.id, formData)
        toast({ title: 'File uploaded', description: `${file.name} is available in Downloads.` })
        refreshFiles()
      } catch (error) {
        runtimeActionErrorToast('Could not upload file', error)
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    })
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
      title='Downloads'
      description='Mapped to the runtime Download folder.'
      icon={<IconFileDownload className='size-5' />}
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
      {files.length === 0 ? (
        <div className='rounded-md bg-background/25 px-4 py-6 text-center text-sm text-secondary-foreground'>
          {runtimeAvailable ? 'No files in Downloads yet.' : 'Start the app to browse Downloads.'}
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
    </ToolSection>
  )
}
