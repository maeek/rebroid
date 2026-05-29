'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import type { DragEvent } from 'react'
import { IconDownload, IconFileDownload, IconFolderUp, IconLoader2, IconRefresh } from '@tabler/icons-react'
import classNames from 'classnames'
import { useTopLoader } from 'nextjs-toploader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Visible } from '@/components/ui/visible'
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
  const [isUnavailableWarningVisible, setIsUnavailableWarningVisible] = useState(false)

  const [isRefreshingFiles, startRefreshFilesTransition] = useTransition()
  const isUploading = uploadProgress !== null
  const savedProfiles = app.savedProfiles ?? []
  const persistentProfiles = savedProfiles.filter(profile => profile.mode === 'persistent')
  const selectedPersistentProfileExists =
    profileMode === 'persistent' &&
    persistentProfiles.some(profile => profile.name === (profileName.trim() || 'default'))
  const selectedProfileCanUseFiles = profileMode === 'temporary' ? runtimeAvailable : selectedPersistentProfileExists
  const currentProfile: { mode: ApplicationProfileMode; name: string } =
    app.profileMode === 'temporary'
      ? { mode: 'temporary', name: 'temporary' }
      : (savedProfiles.find(p => p.name === app.profileName) ?? { mode: 'persistent', name: 'default' })
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
        } catch (error) {
          setFiles([])
          setIsUnavailableWarningVisible(true)
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
      icon={<IconFileDownload className='size-6' />}
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
          selectedProfile={app.running ? currentProfile : undefined}
          mode={profileMode}
          name={profileName}
          savedProfiles={savedProfiles}
          disabled={isUploading}
          allowCustomName={false}
          onModeChange={handleProfileModeChange}
          onNameChange={setProfileName}
        />

        <Visible when={selectedProfileCanUseFiles && !isUnavailableWarningVisible}>
          <div className='overflow-hidden rounded-md border border-border/65 bg-secondary/20'>
            <div className='flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3'>
              <div className='min-w-0'>
                <p className='text-sm font-semibold'>Files</p>
                <p className='text-xs text-muted-foreground'>Downloads folder</p>
              </div>
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
            <div className='divide-y divide-border/55'>
              {files.map(file => (
                <div
                  key={file.path}
                  className='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-sm max-sm:grid-cols-1'
                >
                  <div className='min-w-0'>
                    <button
                      className='truncate font-medium hover:underline cursor-pointer'
                      onClick={() => handleDownload(file.name)}
                    >
                      {file.name}
                    </button>
                    <div className='text-xs text-secondary-foreground'>
                      {formatBytes(file.sizeBytes)}
                      {file.modifiedAt ? ` • ${formatUtcDateTime(file.modifiedAt)}` : ''}
                    </div>
                  </div>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    onClick={() => handleDownload(file.name)}
                  >
                    <IconDownload className='size-4' />
                  </Button>
                </div>
              ))}
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
                  `flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg rounded-tl-none! rounded-tr-none! border border-dashed px-4 py-6 text-center transition w-full`,
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
                    : 'Drop files here'}
                </span>
                <span className='text-xs'>Files are copied to the Android Downloads folder.</span>
              </button>
            </div>
          </div>
        </Visible>
      </div>
    </ToolSection>
  )
}
