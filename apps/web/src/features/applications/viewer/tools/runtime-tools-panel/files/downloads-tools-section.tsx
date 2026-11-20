'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FileDropZone } from '@/components/ui/file-drop-zone'
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

type FileActionFocus = { appId: string; folder: string; path?: string }

export const DownloadsToolsSection = ({ app, permissions }: { app: AppDefinition; permissions: PermissionMap }) => {
  const runtimeAvailable = app.status === 'running'
  const { canTransferFiles, canManageFiles } = resolveRuntimeFileAccess(permissions)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileTriggerRef = useRef<HTMLButtonElement>(null)
  const currentFolderRef = useRef<HTMLSpanElement>(null)
  const focusFolderOnNavigation = useRef(false)
  const completedFileAction = useRef<FileActionFocus | null>(null)
  const [fileActionFocus, setFileActionFocus] = useState<FileActionFocus | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [renameEntry, setRenameEntry] = useState<ApplicationRuntimeFile | null>(null)
  const [deleteEntry, setDeleteEntry] = useState<ApplicationRuntimeFile | null>(null)
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

  const restoreFileFocus = useCallback((found: boolean) => {
    if (!found) currentFolderRef.current?.focus()
    setFileActionFocus(null)
  }, [])

  const restoreAfterDialog = () => {
    const action = completedFileAction.current
    completedFileAction.current = null
    if (!action || action.appId !== app.id || action.folder !== currentPath || !runtimeAvailable) return
    setFileActionFocus(action)
  }

  const renameAndRestoreFocus = async (entry: ApplicationRuntimeFile, name: string) => {
    const renamed = await browser.renameFile(entry, name)
    if (!renamed) return false
    completedFileAction.current = {
      appId: app.id,
      folder: currentPath,
      path: renamed.path
    }
    return true
  }

  const deleteAndRestoreFocus = async (entry: ApplicationRuntimeFile) => {
    const index = browser.files.findIndex(file => file.path === entry.path)
    const neighbor = index >= 0 ? (browser.files[index + 1] ?? browser.files[index - 1]) : undefined
    if (!(await browser.deleteFile(entry))) return false
    completedFileAction.current = {
      appId: app.id,
      folder: currentPath,
      path: neighbor?.path
    }
    return true
  }

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
        <FileDropZone
          className='grid gap-4'
          onFiles={addFiles}
          description={`Destination: ${browser.currentPath}`}
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
            focusRequest={
              fileActionFocus?.appId === app.id && fileActionFocus.folder === currentPath ? fileActionFocus : null
            }
            onFocusRestored={restoreFileFocus}
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
        </FileDropZone>
      )}

      <Sheet
        open={runtimeAvailable && detailsOpen && browser.selectedFile !== null}
        onOpenChange={setDetailsOpen}
      >
        <SheetContent
          className='w-[min(28rem,100vw)] overflow-y-auto transform-gpu sm:max-w-none'
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
        onActionClosed={restoreAfterDialog}
        onDelete={deleteAndRestoreFocus}
        onDeleteEntryChange={setDeleteEntry}
        onRename={renameAndRestoreFocus}
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
