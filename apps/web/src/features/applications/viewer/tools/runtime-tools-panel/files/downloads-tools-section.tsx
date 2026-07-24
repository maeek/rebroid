'use client'

import { useEffect, useRef, useState } from 'react'
import { IconUpload } from '@tabler/icons-react'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import { StateView } from '@/shared/ui/state-view'
import { ToolSection } from '../tool-section'
import { RuntimeFileDialogs } from './runtime-file-dialogs'
import { RuntimeFileInspector } from './runtime-file-inspector'
import { RuntimeFileList } from './runtime-file-list'
import { RuntimeFileLocations } from './runtime-file-locations'
import { RuntimeFileToolbar } from './runtime-file-toolbar'
import { RuntimeFileUploadQueue } from './runtime-file-upload-queue'
import { useRuntimeFileBrowser } from './use-runtime-file-browser'
import { useRuntimeFileUploads } from './use-runtime-file-uploads'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ApplicationRuntimeFile } from '@/shared/contracts/application'

const useDesktopWorkspace = () => {
  const [desktop, setDesktop] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const update = () => setDesktop(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return desktop
}

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
  const canManageFiles = hasPermission(permissions, 'applications:manage-files')
  const desktopWorkspace = useDesktopWorkspace()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragDepthRef = useRef(0)
  const [browseOpen, setBrowseOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [renameEntry, setRenameEntry] = useState<ApplicationRuntimeFile | null>(null)
  const [deleteEntry, setDeleteEntry] = useState<ApplicationRuntimeFile | null>(null)
  const [dragging, setDragging] = useState(false)
  const browser = useRuntimeFileBrowser({ appId: app.id, canTransferFiles, runtimeAvailable })
  const uploads = useRuntimeFileUploads(app.id)

  useEffect(() => {
    if (!desktopWorkspace) return
    setBrowseOpen(false)
    setDetailsOpen(false)
  }, [desktopWorkspace])

  if (!canTransferFiles) return null

  const selectFile = (entry: ApplicationRuntimeFile) => {
    browser.setSelectedFile(entry)
    if (!desktopWorkspace) setDetailsOpen(true)
  }

  const navigateTo = (path: string) => {
    browser.navigateTo(path)
    setBrowseOpen(false)
    setDetailsOpen(false)
  }

  const addFiles = (files: FileList | File[]) => {
    if (files.length === 0) return
    uploads.addFiles(files, browser.currentPath)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <ToolSection
      title='Files'
      description='Browse the active runtime data volume and transfer files.'
      className={className}
      hideHeader={hideHeader}
    >
      {!runtimeAvailable ? (
        <StateView
          scope='grid'
          kind='unavailable'
          title='Runtime files are unavailable'
          description='Start the application to browse its runtime data volume.'
        />
      ) : (
        <div
          className='relative overflow-hidden rounded-panel border border-surface-border/65 bg-surface-panel/55'
          onDragEnter={event => {
            event.preventDefault()
            dragDepthRef.current += 1
            if (event.dataTransfer.types.includes('Files')) setDragging(true)
          }}
          onDragOver={event => event.preventDefault()}
          onDragLeave={event => {
            event.preventDefault()
            dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
            if (dragDepthRef.current === 0) setDragging(false)
          }}
          onDrop={event => {
            event.preventDefault()
            dragDepthRef.current = 0
            setDragging(false)
            addFiles(event.dataTransfer.files)
          }}
        >
          <Input
            ref={fileInputRef}
            type='file'
            multiple
            className='hidden'
            onChange={event => {
              if (event.target.files) addFiles(event.target.files)
            }}
          />
          <RuntimeFileToolbar
            canManageFiles={canManageFiles}
            currentPath={browser.currentPath}
            isRefreshing={browser.isRefreshing}
            searchQuery={browser.searchQuery}
            sort={browser.sort}
            sortDirection={browser.sortDirection}
            onBrowse={() => setBrowseOpen(true)}
            onCreateFolder={() => setCreateOpen(true)}
            onPathChange={navigateTo}
            onRefresh={() => void browser.refresh()}
            onSearchChange={browser.setSearchQuery}
            onSortChange={browser.setSort}
            onSortDirectionChange={browser.setSortDirection}
            onUpload={() => fileInputRef.current?.click()}
          />
          <span
            className='sr-only'
            role='status'
            aria-live='polite'
          >
            {browser.hasLoadedFiles
              ? `${browser.files.length} entries in ${browser.currentPath}${browser.isRefreshing ? ', refreshing' : ''}.`
              : `Loading ${browser.currentPath}.`}
          </span>

          <div
            className={cn(
              'min-h-[28rem] lg:grid',
              browser.selectedFile ? 'lg:grid-cols-[220px_minmax(0,1fr)_320px]' : 'lg:grid-cols-[220px_minmax(0,1fr)]'
            )}
          >
            <aside className='scrollbar-thin hidden max-h-[38rem] overflow-y-auto border-r border-surface-border/60 p-3 lg:block'>
              <RuntimeFileLocations
                appId={app.id}
                currentPath={browser.currentPath}
                onNavigate={navigateTo}
                onPrefetch={path => void browser.prefetchPath(path)}
              />
            </aside>
            <div className='min-w-0'>
              <RuntimeFileList
                canManageFiles={canManageFiles}
                error={browser.error}
                files={browser.files}
                hasLoadedFiles={browser.hasLoadedFiles}
                searchQuery={browser.searchQuery}
                selectedFile={browser.selectedFile}
                onDelete={setDeleteEntry}
                onDownload={entry => void browser.downloadFile(entry)}
                onPathChange={navigateTo}
                onPrefetch={path => void browser.prefetchPath(path)}
                onRefresh={() => void browser.refresh()}
                onRename={setRenameEntry}
                onSelect={selectFile}
              />
            </div>
            {browser.selectedFile ? (
              <aside className='scrollbar-thin hidden max-h-[38rem] overflow-y-auto border-l border-surface-border/60 p-4 lg:block'>
                <RuntimeFileInspector
                  appId={app.id}
                  canManageFiles={canManageFiles}
                  entry={browser.selectedFile}
                  onDelete={setDeleteEntry}
                  onDownload={entry => void browser.downloadFile(entry)}
                  onRename={setRenameEntry}
                />
              </aside>
            ) : null}
          </div>

          <RuntimeFileUploadQueue
            activeCount={uploads.activeCount}
            items={uploads.items}
            onCancel={uploads.cancel}
            onDismiss={uploads.dismiss}
            onRetry={uploads.retry}
          />

          {dragging ? (
            <div className='pointer-events-none absolute inset-2 z-40 flex items-center justify-center rounded-panel border-2 border-dashed border-primary bg-surface-elevated/92 text-center shadow-floating supports-[backdrop-filter]:backdrop-blur-md'>
              <div className='grid gap-2 px-6'>
                <IconUpload className='mx-auto size-10 text-primary' />
                <div className='text-lg font-medium'>Drop files to upload</div>
                <div className='break-all text-sm text-foreground-muted'>Destination: {browser.currentPath}</div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <Sheet
        open={!desktopWorkspace && browseOpen}
        onOpenChange={setBrowseOpen}
      >
        <SheetContent
          side='left'
          className='w-[min(90vw,24rem)] p-4 lg:hidden'
        >
          <SheetHeader className='mb-5 pr-8'>
            <SheetTitle>Browse</SheetTitle>
            <SheetDescription>Choose a runtime folder.</SheetDescription>
          </SheetHeader>
          <RuntimeFileLocations
            appId={app.id}
            currentPath={browser.currentPath}
            onNavigate={navigateTo}
            onPrefetch={path => void browser.prefetchPath(path)}
          />
        </SheetContent>
      </Sheet>

      <Sheet
        open={!desktopWorkspace && detailsOpen && browser.selectedFile !== null}
        onOpenChange={setDetailsOpen}
      >
        <SheetContent
          side='bottom'
          className='max-h-[85dvh] overflow-y-auto p-4 lg:hidden'
        >
          <SheetHeader className='sr-only'>
            <SheetTitle>File details</SheetTitle>
            <SheetDescription>Preview and actions for the selected file.</SheetDescription>
          </SheetHeader>
          {browser.selectedFile ? (
            <RuntimeFileInspector
              appId={app.id}
              canManageFiles={canManageFiles}
              entry={browser.selectedFile}
              onDelete={setDeleteEntry}
              onDownload={entry => void browser.downloadFile(entry)}
              onRename={setRenameEntry}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <RuntimeFileDialogs
        createOpen={createOpen}
        deleteEntry={deleteEntry}
        renameEntry={renameEntry}
        onCreate={browser.createDirectory}
        onCreateOpenChange={setCreateOpen}
        onDelete={browser.deleteFile}
        onDeleteEntryChange={setDeleteEntry}
        onRename={browser.renameFile}
        onRenameEntryChange={setRenameEntry}
      />
    </ToolSection>
  )
}
