'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import type { DragEvent } from 'react'
import {
  IconArrowUp,
  IconDownload,
  IconFile,
  IconFolder,
  IconFolderUp,
  IconLayoutGrid,
  IconList,
  IconLoader2,
  IconRefresh
} from '@tabler/icons-react'
import classNames from 'classnames'
import { useTopLoader } from 'nextjs-toploader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { formatDateLocale } from '@/lib/format'
import {
  downloadApplicationRuntimeFileAction,
  listApplicationFilesAction
} from '@/server/orchestrator/applications/read-actions'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import { downloadDataUrl, formatBytes, runtimeActionErrorToast } from './runtime-tools-panel.utils'
import { ToolSection } from './tool-section'
import { uploadDownloadFileWithProgress } from './upload-download-file'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ApplicationRuntimeFile } from '@/server/orchestrator/applications/types'

type BrowserView = 'list' | 'tiles'

const rootPath = '/data'
const parentPath = (path: string) => path.slice(0, path.lastIndexOf('/')) || rootPath
const itemLabel = (count: number | null) => `${count ?? 0} item${count === 1 ? '' : 's'}`

export const DownloadsToolsSection = ({
  app,
  permissions,
  className,
  hideHeader
}: {
  app: AppDefinition
  permissions: PermissionMap
  className?: string
  hideHeader?: boolean
}) => {
  const runtimeAvailable = app.status === 'running'
  const canTransferFiles = hasPermission(permissions, 'applications:transfer-files')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const topLoader = useTopLoader()
  const [currentPath, setCurrentPath] = useState(rootPath)
  const [files, setFiles] = useState<ApplicationRuntimeFile[]>([])
  const [view, setView] = useState<BrowserView>('list')
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadFileName, setUploadFileName] = useState('')
  const [isRefreshingFiles, startRefreshFilesTransition] = useTransition()
  const isUploading = uploadProgress !== null

  const refreshFiles = useCallback(
    (options: { notifyOnError?: boolean } = {}) => {
      if (!runtimeAvailable || !canTransferFiles) return
      startRefreshFilesTransition(async () => {
        try {
          setFiles(await listApplicationFilesAction(app.id, currentPath))
        } catch (error) {
          setFiles([])
          if (options.notifyOnError) runtimeActionErrorToast('Could not list files', error)
        }
      })
    },
    [app.id, canTransferFiles, currentPath, runtimeAvailable]
  )

  useEffect(() => {
    setCurrentPath(rootPath)
  }, [app.id])

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
      appId: app.id,
      file,
      path: currentPath,
      onProgress: progress => {
        setUploadProgress(progress)
        topLoader.setProgress(Math.min(Math.max(progress / 100, 0.08), 0.95))
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

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setIsDragging(false)
    if (!runtimeAvailable || isUploading) return
    handleFileUpload(event.dataTransfer.files?.[0])
  }

  const handleDownload = (file: ApplicationRuntimeFile) => {
    startRefreshFilesTransition(async () => {
      try {
        const download = await downloadApplicationRuntimeFileAction(app.id, file.path)
        downloadDataUrl(download.dataUrl, download.name)
      } catch (error) {
        runtimeActionErrorToast('Could not download file', error)
      }
    })
  }

  if (!canTransferFiles) return null

  const pathParts = currentPath.split('/').filter(Boolean)
  const entryDetail = (entry: ApplicationRuntimeFile) =>
    entry.type === 'directory' ? itemLabel(entry.itemCount) : formatBytes(entry.sizeBytes ?? 0)

  return (
    <ToolSection
      title='Files'
      description='Browse the active runtime data volume and transfer files.'
      className={className}
      hideHeader={hideHeader}
    >
      <Input
        ref={fileInputRef}
        type='file'
        className='hidden'
        onChange={event => handleFileUpload(event.target.files?.[0])}
      />
      {!runtimeAvailable ? (
        <div className='rounded-md border border-border/65 bg-secondary/20 px-4 py-6 text-sm text-muted-foreground'>
          Files are available while the application runtime is running.
        </div>
      ) : (
        <div className='overflow-hidden rounded-md border border-border/65 bg-secondary/20'>
          <div className='flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3'>
            <div className='flex min-w-0 items-center gap-1 text-sm'>
              {pathParts.map((part, index) => {
                const path = `/${pathParts.slice(0, index + 1).join('/')}`
                const active = path === currentPath
                return (
                  <span
                    key={path}
                    className='flex min-w-0 items-center gap-1'
                  >
                    {index > 0 ? <span className='text-muted-foreground'>/</span> : null}
                    <button
                      type='button'
                      className={classNames(
                        'truncate',
                        active ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'
                      )}
                      disabled={active}
                      onClick={() => setCurrentPath(path)}
                    >
                      {part}
                    </button>
                  </span>
                )
              })}
            </div>
            <div className='flex items-center gap-1'>
              <Button
                type='button'
                size='sm'
                variant='ghost'
                disabled={currentPath === rootPath}
                onClick={() => setCurrentPath(parentPath(currentPath))}
                aria-label='Go to parent folder'
              >
                <IconArrowUp className='size-4' />
              </Button>
              <Button
                type='button'
                size='sm'
                variant={view === 'list' ? 'secondary' : 'ghost'}
                onClick={() => setView('list')}
                aria-label='List view'
              >
                <IconList className='size-4' />
              </Button>
              <Button
                type='button'
                size='sm'
                variant={view === 'tiles' ? 'secondary' : 'ghost'}
                onClick={() => setView('tiles')}
                aria-label='Tile view'
              >
                <IconLayoutGrid className='size-4' />
              </Button>
              <Button
                type='button'
                size='sm'
                variant='ghost'
                disabled={isRefreshingFiles}
                onClick={() => refreshFiles({ notifyOnError: true })}
              >
                {isRefreshingFiles ? (
                  <IconLoader2 className='size-4 animate-spin' />
                ) : (
                  <IconRefresh className='size-4' />
                )}
                Refresh
              </Button>
            </div>
          </div>
          {view === 'list' ? (
            <div className='divide-y divide-border/55'>
              {files.map(entry => (
                <div
                  key={entry.path}
                  className='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-sm'
                >
                  <button
                    type='button'
                    className='flex min-w-0 items-center gap-3 text-left'
                    onClick={() => (entry.type === 'directory' ? setCurrentPath(entry.path) : handleDownload(entry))}
                  >
                    {entry.type === 'directory' ? (
                      <IconFolder className='size-5 shrink-0 text-primary' />
                    ) : (
                      <IconFile className='size-5 shrink-0 text-muted-foreground' />
                    )}
                    <span className='min-w-0'>
                      <span className='block truncate font-medium hover:underline'>{entry.name}</span>
                      <span className='block text-xs text-secondary-foreground'>
                        {entryDetail(entry)}
                        {entry.modifiedAt ? ` • ${formatDateLocale(entry.modifiedAt)}` : ''}
                      </span>
                    </span>
                  </button>
                  {entry.type === 'file' ? (
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      onClick={() => handleDownload(entry)}
                      aria-label={`Download ${entry.name}`}
                    >
                      <IconDownload className='size-4' />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className='grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4'>
              {files.map(entry => (
                <button
                  key={entry.path}
                  type='button'
                  className='flex min-w-0 flex-col items-center gap-2 rounded-md border border-border/60 bg-background/25 px-3 py-4 text-center hover:bg-accent/50'
                  onClick={() => (entry.type === 'directory' ? setCurrentPath(entry.path) : handleDownload(entry))}
                >
                  {entry.type === 'directory' ? (
                    <IconFolder className='size-8 text-primary' />
                  ) : (
                    <IconFile className='size-8 text-muted-foreground' />
                  )}
                  <span className='w-full truncate text-sm font-medium'>{entry.name}</span>
                  <span className='text-xs text-muted-foreground'>{entryDetail(entry)}</span>
                </button>
              ))}
            </div>
          )}
          <button
            type='button'
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={event => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={classNames(
              'flex min-h-24 w-full flex-col items-center justify-center gap-2 border-t border-dashed px-4 py-5 text-center transition',
              {
                'border-primary/70 bg-primary/10 text-foreground': isDragging,
                'border-border/90 bg-secondary/35 text-secondary-foreground': !isDragging,
                'hover:border-primary/55 hover:bg-secondary/45': !isUploading
              }
            )}
          >
            {isUploading ? <IconLoader2 className='size-6 animate-spin' /> : <IconFolderUp className='size-6' />}
            <span className='font-medium text-foreground'>
              {isUploading
                ? `Uploading ${uploadFileName || 'file'} (${uploadProgress ?? 0}%)`
                : 'Drop files here or click to upload'}
            </span>
            <span className='text-xs'>Files are copied into {currentPath}.</span>
          </button>
        </div>
      )}
    </ToolSection>
  )
}
