import type { Ref } from 'react'
import {
  IconChevronDown,
  IconChevronRight,
  IconFolder,
  IconFolderDown,
  IconFolderPlus,
  IconUpload
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  runtimeDownloadsPath,
  runtimeFileLocations,
  runtimeInternalStoragePath,
  runtimePathForPartIndex,
  runtimePathParts
} from './downloads-tools-section-model'

const quickLocations = runtimeFileLocations.slice(0, 3)
const otherLocations = runtimeFileLocations.slice(3)

export const RuntimeFileToolbar = ({
  canManageFiles,
  currentPath,
  currentFolderRef,
  disabled = false,
  onCreateFolder,
  onPathChange,
  onUpload
}: {
  canManageFiles: boolean
  currentPath: string
  currentFolderRef?: Ref<HTMLSpanElement>
  disabled?: boolean
  onCreateFolder: () => void
  onPathChange: (path: string) => void
  onUpload: () => void
}) => {
  const pathParts = runtimePathParts(currentPath)
  const breadcrumbs = pathParts.flatMap((part, index) => {
    const path = runtimePathForPartIndex(pathParts, index)
    if (currentPath.startsWith(`${runtimeInternalStoragePath}/`) || currentPath === runtimeInternalStoragePath) {
      if (path.length < runtimeInternalStoragePath.length) return []
    }
    return [{ path, label: runtimeFileLocations.find(location => location.path === path)?.label ?? part }]
  })

  return (
    <div className='grid min-w-0 gap-4'>
      <nav
        aria-label='File locations'
        className='flex min-w-0 flex-wrap items-center gap-1'
      >
        {quickLocations.map(({ label, path }) => {
          const selected = currentPath === path
          const Icon = path === runtimeDownloadsPath ? IconFolderDown : IconFolder
          return (
            <Button
              key={path}
              type='button'
              size='sm'
              variant={selected ? 'secondary' : 'ghost'}
              aria-current={selected ? 'location' : undefined}
              disabled={disabled}
              onClick={() => onPathChange(path)}
            >
              <Icon className='size-4' />
              {label}
            </Button>
          )
        })}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type='button'
              size='sm'
              variant='ghost'
              disabled={disabled}
            >
              More folders
              <IconChevronDown className='size-3.5' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='start'>
            {otherLocations.map(location => (
              <DropdownMenuItem
                key={location.path}
                aria-current={currentPath === location.path ? 'location' : undefined}
                onClick={() => onPathChange(location.path)}
              >
                {location.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
      <div className='flex min-w-0 flex-wrap items-center justify-between gap-3'>
        <nav
          aria-label='Current folder'
          className='min-w-0'
        >
          <ol className='flex min-w-0 flex-wrap items-center gap-x-1 text-sm'>
            {breadcrumbs.map(({ label, path }, index) => (
              <li
                key={path}
                className='flex min-w-0 items-center gap-1'
              >
                {index > 0 ? (
                  <IconChevronRight
                    aria-hidden
                    className='size-3 shrink-0 text-foreground-muted'
                  />
                ) : null}
                {path === currentPath ? (
                  <span
                    ref={currentFolderRef}
                    className='min-w-0 break-all px-1 font-medium'
                    aria-current='location'
                    tabIndex={-1}
                  >
                    {label}
                  </span>
                ) : (
                  <Button
                    type='button'
                    size='sm'
                    variant='ghost'
                    className='h-auto min-w-0 whitespace-normal break-all px-1 text-left text-foreground-muted'
                    disabled={disabled}
                    onClick={() => onPathChange(path)}
                  >
                    {label}
                  </Button>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <div className='flex flex-wrap gap-2'>
          {canManageFiles ? (
            <Button
              type='button'
              size='sm'
              variant='outline'
              disabled={disabled}
              onClick={onCreateFolder}
            >
              <IconFolderPlus className='size-4' />
              New folder
            </Button>
          ) : null}
          <Button
            type='button'
            size='sm'
            disabled={disabled}
            onClick={onUpload}
          >
            <IconUpload className='size-4' />
            Upload files
          </Button>
        </div>
      </div>
    </div>
  )
}
