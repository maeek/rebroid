'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { IconUpload } from '@tabler/icons-react'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { resolveRuntimeFileAccess } from '@/shared/permissions/runtime-files'
import { StateView } from '@/shared/ui/state-view'
import { runtimeDownloadsPath } from './downloads-tools-section-model'
import { RuntimeFileDialogs } from './runtime-file-dialogs'
import { RuntimeFileInspector } from './runtime-file-inspector'
import { RuntimeFileList } from './runtime-file-list'
import { RuntimeFileToolbar } from './runtime-file-toolbar'
import { RuntimeFileUploadQueue } from './runtime-file-upload-queue'
import { useRuntimeFileBrowser } from './use-runtime-file-browser'
import { useRuntimeFileUploads } from './use-runtime-file-uploads'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ApplicationRuntimeFile } from '@/shared/contracts/application'
import type { PermissionMap } from '@/shared/permissions/permissions'

export const DownloadsToolsSection = ({ app, permissions }: { app: AppDefinition; permissions: PermissionMap }) => {
  const runtimeAvailable = app.status === 'running'
  const { canTransferFiles, canManageFiles } = resolveRuntimeFileAccess(permissions)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragDepthRef = useRef(0)
  const fileTriggerRef = useRef<HTMLButtonElement>(null)
  const currentFolderRef = useRef<HTMLSpanElement>(null)
  const focusFolderOnNavigation = useRef(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [renameEntry, setRenameEntry] = useState<ApplicationRuntimeFile | null>(null)
  const [deleteEntry, setDeleteEntry] = useState<ApplicationRuntimeFile | null>(null)
  const [dragging, setDragging] = useState(false)
  const browser = useRuntimeFileBrowser({ appId: app.id, canTransferFiles, runtimeAvailable })
  const uploads = useRuntimeFileUploads(app.id)

  const { currentPath, navigateTo, prefetchPath, setSelectedFile } = browser
  const navigateToFolder = useCallback(
    (path: string) => {
      focusFolderOnNavigation.current = path !== currentPath
      navigateTo(path)
    },
    [currentPath, navigateTo]
  )

  useEffect(() => {
    if (!focusFolderOnNavigation.current) return
    focusFolderOnNavigation.current = false
    currentFolderRef.current?.focus()
  }, [currentPath])

  const openEntry = useCallback(
    (entry: ApplicationRuntimeFile, trigger?: HTMLButtonElement) => {
      if (entry.type === 'directory') {
        navigateToFolder(entry.path)
        return
      }
      fileTriggerRef.current = trigger ?? null
      setSelectedFile(entry)
      setDetailsOpen(true)
    },
    [navigateToFolder, setSelectedFile]
  )

  const prefetchFolder = useCallback(
    (path: string) => {
      void prefetchPath(path)
    },
    [prefetchPath]
  )

  if (!canTransferFiles) return null

  const openRename = (entry: ApplicationRuntimeFile) => {
    setDetailsOpen(false)
    setRenameEntry(entry)
  }

  const openDelete = (entry: ApplicationRuntimeFile) => {
    setDetailsOpen(false)
    setDeleteEntry(entry)
  }

  const addFiles = (files: FileList | File[]) => {
    if (files.length === 0) return
    uploads.addFiles(files, browser.currentPath)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <>
      {!runtimeAvailable ? (
        <StateView
          scope='grid'
          kind='unavailable'
          title='Runtime files are unavailable'
          description='Start the application to browse its runtime data volume.'
        />
      ) : (
        <div
          className='relative grid min-w-0 gap-4'
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
            currentFolderRef={currentFolderRef}
            onCreateFolder={() => setCreateOpen(true)}
            onPathChange={navigateToFolder}
            onUpload={() => fileInputRef.current?.click()}
          />
          <span
            className='sr-only'
            role='status'
          >
            {browser.hasLoadedFiles
              ? `${browser.files.length} entries in ${browser.currentPath}${browser.isRefreshing ? ', refreshing' : ''}.`
              : browser.error
                ? ''
                : `Loading ${browser.currentPath}.`}
          </span>
          <RuntimeFileList
            key={browser.currentPath}
            onUpload={() => fileInputRef.current?.click()}
            canManageFiles={canManageFiles}
            error={browser.error}
            files={browser.files}
            loading={!browser.hasLoadedFiles && !browser.error}
            refreshing={browser.isRefreshing}
            searchQuery={browser.searchQuery}
            sort={browser.sort}
            sortDirection={browser.sortDirection}
            onDelete={openDelete}
            onDownload={entry => void browser.downloadFile(entry)}
            onOpen={openEntry}
            onPrefetch={prefetchFolder}
            onRefresh={() => void browser.refresh()}
            onRename={openRename}
            onSearchChange={browser.setSearchQuery}
            onSort={(sort, direction) => {
              browser.setSort(sort)
              browser.setSortDirection(direction)
            }}
          />

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
        open={runtimeAvailable && detailsOpen && browser.selectedFile !== null}
        onOpenChange={setDetailsOpen}
      >
        <SheetContent
          className='w-[min(28rem,100vw)] overflow-y-auto sm:max-w-none'
          finalFocus={fileTriggerRef}
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
              onDelete={openDelete}
              onDownload={entry => void browser.downloadFile(entry)}
              onRename={openRename}
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
    </>
  )
}

const noop = () => undefined

export const DownloadsToolsLoading = () => (
  <div className='grid min-w-0 gap-4'>
    <RuntimeFileToolbar
      canManageFiles
      currentPath={runtimeDownloadsPath}
      disabled
      onCreateFolder={noop}
      onPathChange={noop}
      onUpload={noop}
    />
    <RuntimeFileList
      canManageFiles
      loading
      error={null}
      files={[]}
      searchQuery=''
      sort='name'
      sortDirection='asc'
      onDelete={noop}
      onDownload={noop}
      onOpen={noop}
      onPrefetch={noop}
      onRefresh={noop}
      onRename={noop}
      onSearchChange={noop}
      onSort={noop}
    />
  </div>
)
