'use client'

import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { IconDotsVertical, IconDownload, IconFile, IconFolder, IconPencil, IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { StateView } from '@/shared/ui/state-view'
import { runtimeFileEntryDetail, runtimeFileEntrySubtitle } from './downloads-tools-section-model'
import type { ApplicationRuntimeFile } from '@/shared/contracts/application'

const moveEntryFocus = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
  if (!['ArrowDown', 'ArrowUp', 'End', 'Home'].includes(event.key)) return
  const scope = event.currentTarget.closest('[data-runtime-file-list]')
  if (!scope) return
  const entries = Array.from(scope.querySelectorAll<HTMLButtonElement>('[data-runtime-file-entry]'))
  const currentIndex = entries.indexOf(event.currentTarget)
  if (currentIndex < 0) return
  event.preventDefault()
  let nextIndex = event.key === 'Home' ? 0 : entries.length - 1
  if (event.key === 'ArrowDown') nextIndex = Math.min(currentIndex + 1, entries.length - 1)
  if (event.key === 'ArrowUp') nextIndex = Math.max(currentIndex - 1, 0)
  entries[nextIndex]?.focus()
}

const RuntimeFileActions = ({
  canManageFiles,
  entry,
  onDelete,
  onDownload,
  onRename
}: {
  canManageFiles: boolean
  entry: ApplicationRuntimeFile
  onDelete: (entry: ApplicationRuntimeFile) => void
  onDownload: (entry: ApplicationRuntimeFile) => void
  onRename: (entry: ApplicationRuntimeFile) => void
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        type='button'
        size='icon-sm'
        variant='ghost'
        className='size-11 sm:size-8'
        aria-label={`Actions for ${entry.name}`}
      >
        <IconDotsVertical className='size-4' />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align='end'>
      {entry.type === 'file' ? (
        <DropdownMenuItem onClick={() => onDownload(entry)}>
          <IconDownload className='size-4' />
          Download
        </DropdownMenuItem>
      ) : null}
      {canManageFiles ? (
        <>
          <DropdownMenuItem onClick={() => onRename(entry)}>
            <IconPencil className='size-4' />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className='text-danger data-[highlighted]:text-danger'
            onClick={() => onDelete(entry)}
          >
            <IconTrash className='size-4' />
            Delete
          </DropdownMenuItem>
        </>
      ) : null}
    </DropdownMenuContent>
  </DropdownMenu>
)

const RuntimeFileLoadingRows = () => (
  <>
    {Array.from({ length: 8 }, (_, index) => (
      <TableRow key={index}>
        <TableCell>
          <div className='flex items-center gap-3'>
            <Skeleton className='size-5 rounded-control' />
            <Skeleton className='h-4 w-40 max-w-[60vw]' />
          </div>
        </TableCell>
        <TableCell>
          <Skeleton className='h-4 w-16' />
        </TableCell>
        <TableCell>
          <Skeleton className='h-4 w-16' />
        </TableCell>
        <TableCell>
          <Skeleton className='h-4 w-28' />
        </TableCell>
        <TableCell />
      </TableRow>
    ))}
  </>
)

export const RuntimeFileList = ({
  canManageFiles,
  error,
  files,
  hasLoadedFiles,
  onDelete,
  onDownload,
  onPathChange,
  onPrefetch,
  onRefresh,
  onRename,
  onSelect,
  searchQuery,
  selectedFile
}: {
  canManageFiles: boolean
  error: Error | null
  files: ApplicationRuntimeFile[]
  hasLoadedFiles: boolean
  onDelete: (entry: ApplicationRuntimeFile) => void
  onDownload: (entry: ApplicationRuntimeFile) => void
  onPathChange: (path: string) => void
  onPrefetch: (path: string) => void
  onRefresh: () => void
  onRename: (entry: ApplicationRuntimeFile) => void
  onSelect: (entry: ApplicationRuntimeFile) => void
  searchQuery: string
  selectedFile: ApplicationRuntimeFile | null
}) => {
  if (error && !hasLoadedFiles) {
    return (
      <StateView
        scope='grid'
        kind='error'
        title='Could not load this folder'
        description={error.message}
        actions={[{ label: 'Try again', onClick: onRefresh }]}
      />
    )
  }

  if (hasLoadedFiles && files.length === 0) {
    return (
      <StateView
        scope='grid'
        kind={searchQuery ? 'no-results' : 'empty'}
        title={searchQuery ? 'No matching files' : 'This folder is empty'}
        description={searchQuery ? 'Try a different filename.' : 'Upload files or create a folder to get started.'}
      />
    )
  }

  return (
    <>
      <Table
        containerClassName='hidden sm:block'
        data-runtime-file-list
      >
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className='w-28'>Type</TableHead>
            <TableHead className='w-28'>Size</TableHead>
            <TableHead className='w-44'>Modified</TableHead>
            <TableHead className='w-12'>
              <span className='sr-only'>Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!hasLoadedFiles ? <RuntimeFileLoadingRows /> : null}
          {files.map(entry => {
            const selected = selectedFile?.path === entry.path
            return (
              <TableRow
                key={entry.path}
                data-state={selected ? 'selected' : undefined}
                className='[content-visibility:auto] [contain-intrinsic-size:0_52px]'
              >
                <TableCell>
                  <Button
                    data-runtime-file-entry
                    type='button'
                    variant='bare'
                    className='h-auto min-w-0 max-w-full justify-start gap-3 px-0 py-1 text-left'
                    onMouseEnter={() => entry.type === 'directory' && onPrefetch(entry.path)}
                    onFocus={() => entry.type === 'directory' && onPrefetch(entry.path)}
                    onClick={() => (entry.type === 'directory' ? onPathChange(entry.path) : onSelect(entry))}
                    onKeyDown={moveEntryFocus}
                  >
                    {entry.type === 'directory' ? (
                      <IconFolder className='size-5 text-primary' />
                    ) : (
                      <IconFile className='size-5 text-foreground-muted' />
                    )}
                    <span className='truncate'>{entry.name}</span>
                  </Button>
                </TableCell>
                <TableCell className='text-foreground-muted'>
                  {entry.type === 'directory' ? 'Folder' : 'File'}
                </TableCell>
                <TableCell className='text-foreground-muted'>{runtimeFileEntryDetail(entry)}</TableCell>
                <TableCell className='text-foreground-muted'>
                  {entry.modifiedAt ? new Date(entry.modifiedAt).toLocaleString() : '—'}
                </TableCell>
                <TableCell>
                  <RuntimeFileActions
                    canManageFiles={canManageFiles}
                    entry={entry}
                    onDelete={onDelete}
                    onDownload={onDownload}
                    onRename={onRename}
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <div
        className='divide-y divide-border/55 sm:hidden'
        data-runtime-file-list
      >
        {!hasLoadedFiles
          ? Array.from({ length: 7 }, (_, index) => (
              <div
                key={index}
                className='flex min-h-14 items-center gap-3 px-3 py-2'
              >
                <Skeleton className='size-5 rounded-control' />
                <div className='grid flex-1 gap-2'>
                  <Skeleton className='h-4 w-36' />
                  <Skeleton className='h-3 w-48' />
                </div>
              </div>
            ))
          : null}
        {files.map(entry => (
          <div
            key={entry.path}
            className={cn(
              'flex min-h-14 items-center gap-2 px-3 py-2',
              selectedFile?.path === entry.path && 'bg-surface-band'
            )}
          >
            <Button
              data-runtime-file-entry
              type='button'
              variant='bare'
              className='min-h-11 min-w-0 flex-1 justify-start gap-3 text-left'
              onClick={() => (entry.type === 'directory' ? onPathChange(entry.path) : onSelect(entry))}
              onKeyDown={moveEntryFocus}
            >
              {entry.type === 'directory' ? (
                <IconFolder className='size-5 text-primary' />
              ) : (
                <IconFile className='size-5 text-foreground-muted' />
              )}
              <span className='min-w-0'>
                <span className='block truncate'>{entry.name}</span>
                <span className='block truncate text-xs text-foreground-muted'>{runtimeFileEntrySubtitle(entry)}</span>
              </span>
            </Button>
            <RuntimeFileActions
              canManageFiles={canManageFiles}
              entry={entry}
              onDelete={onDelete}
              onDownload={onDownload}
              onRename={onRename}
            />
          </div>
        ))}
      </div>
    </>
  )
}
