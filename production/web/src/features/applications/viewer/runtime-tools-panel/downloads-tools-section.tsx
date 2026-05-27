'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import type { DragEvent } from 'react'
import { IconDownload, IconFileDownload, IconFolderUp, IconLoader2, IconRefresh } from '@tabler/icons-react'
import classNames from 'classnames'
import { useTopLoader } from 'nextjs-toploader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApplicationProfilePicker } from '@/features/applications/profiles/profile-picker'
import { toast } from '@/hooks/use-toast'
import { formatUtcDateTime } from '@/lib/format'
import {
  downloadApplicationFileAction,
  listApplicationDownloadFilesAction
} from '@/server/orchestrator/applications/read-actions'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import { downloadDataUrl, formatBytes, runtimeActionErrorToast } from './runtime-tools-panel.utils'
import { ToolSection } from './tool-section'
import { uploadDownloadFileWithProgress } from './upload-download-file'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ApplicationProfileMode, ApplicationRuntimeFile } from '@/server/orchestrator/applications/types'

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
  const [files, setFiles] = useState<ApplicationRuntimeFile[]>([])
  const [profileMode, setProfileMode] = useState<ApplicationProfileMode>(app.profileMode ?? 'persistent')
  const [profileName, setProfileName] = useState(app.profileName ?? 'default')
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadFileName, setUploadFileName] = useState('')
  const [fileListWarning, setFileListWarning] = useState<string | null>(null)
  const [isRefreshingFiles, startRefreshFilesTransition] = useTransition()
  const isUploading = uploadProgress !== null
  const savedProfiles = app.savedProfiles ?? []
  const persistentProfiles = savedProfiles.filter(profile => profile.mode === 'persistent')
  const selectedPersistentProfileExists =
    profileMode === 'persistent' &&
    persistentProfiles.some(profile => profile.name === (profileName.trim() || 'default'))
  const selectedProfileCanUseFiles = profileMode === 'temporary' ? runtimeAvailable : selectedPersistentProfileExists

  const selectedProfileQuery = useCallback(
    () => ({
      profileMode,
      profileName: profileMode === 'temporary' ? 'temporary' : profileName.trim() || 'default'
    }),
    [profileMode, profileName]
  )

  const refreshFiles = useCallback(
    (options: { notifyOnError?: boolean } = {}) => {
      if (!selectedProfileCanUseFiles || !canTransferFiles) {
        return
      }

      startRefreshFilesTransition(async () => {
        try {
          setFiles(await listApplicationDownloadFilesAction(app.id, selectedProfileQuery()))
          setFileListWarning(null)
        } catch (error) {
          setFiles([])
          setFileListWarning('Files are unavailable for this profile right now.')
          if (options.notifyOnError) {
            runtimeActionErrorToast('Could not list files', error)
          }
        }
      })
    },
    [app.id, canTransferFiles, selectedProfileCanUseFiles, selectedProfileQuery]
  )

  useEffect(() => {
    setProfileMode(app.profileMode ?? 'persistent')
    setProfileName(app.profileName ?? 'default')
  }, [app.id, app.profileMode, app.profileName])

  useEffect(() => {
    if (!selectedProfileCanUseFiles) {
      setFiles([])
      return
    }

    refreshFiles({ notifyOnError: false })
  }, [refreshFiles, selectedProfileCanUseFiles])

  const handleProfileModeChange = (mode: ApplicationProfileMode) => {
    setProfileMode(mode)
    setProfileName(current => {
      if (mode === 'temporary') {
        return 'temporary'
      }

      return current === 'temporary' ? 'default' : current
    })
  }

  const handleFileUpload = (file: File | undefined) => {
    if (!file || !selectedProfileCanUseFiles) {
      return
    }

    setUploadFileName(file.name)
    setUploadProgress(0)
    topLoader.start()
    topLoader.setProgress(0.08)

    uploadDownloadFileWithProgress({
      appId: app.id,
      file,
      ...selectedProfileQuery(),
      onProgress: progress => {
        setUploadProgress(progress)
        topLoader.setProgress(Math.min(Math.max(progress / 100, 0.08), 0.95))
      }
    })
      .then(() => {
        topLoader.setProgress(1)
        toast({ title: 'File uploaded', description: `${file.name} is available in Files.` })
        refreshFiles({ notifyOnError: false })
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
    if (!selectedProfileCanUseFiles || isUploading) {
      return
    }

    handleFileUpload(event.dataTransfer.files?.[0])
  }

  const handleDownload = (fileName: string) => {
    startRefreshFilesTransition(async () => {
      try {
        const file = await downloadApplicationFileAction(app.id, fileName, selectedProfileQuery())
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
      hideHeader={hideHeader}
    >
      <div className='grid gap-4'>
        <Input
          ref={fileInputRef}
          type='file'
          className='hidden'
          onChange={event => handleFileUpload(event.target.files?.[0])}
        />
        <ApplicationProfilePicker
          mode={profileMode}
          name={profileName}
          savedProfiles={savedProfiles}
          disabled={isUploading}
          allowCustomName={false}
          emptyDescription='Start the app with a persistent profile before browsing or uploading files.'
          onModeChange={handleProfileModeChange}
          onNameChange={setProfileName}
        />

        {!selectedProfileCanUseFiles ? null : (
          <>
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
                // eslint-disable-next-line max-len
                `flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition`,
                {
                  'border-primary/70 bg-primary/10 text-foreground': isDragging,
                  'border-border/90 bg-secondary/35 text-secondary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]':
                    !isDragging,
                  'hover:border-primary/55 hover:bg-secondary/45': !isUploading
                }
              )}
            >
              {isUploading ? <IconLoader2 className='size-6 animate-spin' /> : <IconFolderUp className='size-6' />}
              <span className='font-medium text-foreground'>
                {isUploading
                  ? `Uploading ${uploadFileName || 'file'}${uploadProgress === null ? '' : ` (${uploadProgress}%)`}`
                  : 'Drop a file here or choose one'}
              </span>
              <span className='text-xs'>Files are copied to the Android Download folder.</span>
            </button>

            <div className='overflow-hidden rounded-md border border-border/65 bg-secondary/20'>
              <div className='flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3'>
                <div className='min-w-0'>
                  <p className='text-sm font-semibold'>Files</p>
                  <p className='text-xs text-muted-foreground'>Android Download folder</p>
                </div>
                <Button
                  type='button'
                  size='sm'
                  variant='secondary'
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

              {files.length === 0 ? (
                <div className='px-4 py-5 text-center text-sm text-secondary-foreground'>
                  {fileListWarning ?? 'No files in this profile yet.'}
                </div>
              ) : (
                <div className='divide-y divide-border/55'>
                  {files.map(file => (
                    <div
                      key={file.path}
                      className='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-sm max-sm:grid-cols-1'
                    >
                      <div className='min-w-0'>
                        <div className='truncate font-medium'>{file.name}</div>
                        <div className='text-xs text-secondary-foreground'>
                          {formatBytes(file.sizeBytes)}
                          {file.modifiedAt ? ` • ${formatUtcDateTime(file.modifiedAt)}` : ''}
                        </div>
                      </div>
                      <Button
                        type='button'
                        size='sm'
                        variant='secondary'
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
          </>
        )}
      </div>
    </ToolSection>
  )
}
