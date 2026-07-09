'use client'

import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import { ToolSection } from '../tool-section'
import { RuntimeFileDropzone } from './runtime-file-dropzone'
import { RuntimeFileList } from './runtime-file-list'
import { RuntimeFileTiles } from './runtime-file-tiles'
import { RuntimeFileToolbar } from './runtime-file-toolbar'
import { useRuntimeFileBrowser } from './use-runtime-file-browser'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

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
  const {
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
  } = useRuntimeFileBrowser({ appId: app.id, canTransferFiles, runtimeAvailable })

  if (!canTransferFiles) return null

  return (
    <ToolSection
      title='Files'
      description='Browse the active runtime data volume and transfer files.'
      className={className}
      hideHeader={hideHeader}
    >
      {!runtimeAvailable ? (
        <div className='rounded-md border border-border/65 bg-secondary/20 px-4 py-6 text-sm text-muted-foreground'>
          Files are available while the application runtime is running.
        </div>
      ) : (
        <div className='overflow-hidden rounded-md border border-border/65 bg-secondary/20'>
          <RuntimeFileToolbar
            currentPath={currentPath}
            isRefreshingFiles={isRefreshingFiles}
            onPathChange={setCurrentPath}
            onRefresh={() => refreshFiles({ notifyOnError: true })}
            onViewChange={setView}
            view={view}
          />
          {view === 'list' ? (
            <RuntimeFileList
              files={files}
              onDownload={handleDownload}
              onPathChange={setCurrentPath}
            />
          ) : (
            <RuntimeFileTiles
              files={files}
              onDownload={handleDownload}
              onPathChange={setCurrentPath}
            />
          )}
          <RuntimeFileDropzone
            currentPath={currentPath}
            fileInputRef={fileInputRef}
            isUploading={isUploading}
            onFileUpload={handleFileUpload}
            runtimeAvailable={runtimeAvailable}
            uploadFileName={uploadFileName}
            uploadProgress={uploadProgress}
          />
        </div>
      )}
    </ToolSection>
  )
}
