import type { Ref } from 'react'
import { IconChevronDown, IconChevronRight, IconFolder, IconFolderPlus, IconUpload } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { runtimeFileLocations, runtimePathForPartIndex, runtimePathParts } from './downloads-tools-section-model'

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

  return (
    <div className='grid min-w-0 gap-3'>
      <div className='flex min-w-0 flex-wrap items-center justify-between gap-2'>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type='button'
              size='sm'
              variant='outline'
              disabled={disabled}
            >
              <IconFolder className='size-4' />
              Locations
              <IconChevronDown className='size-3.5' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='start'>
            {runtimeFileLocations.map(location => (
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
      <nav
        aria-label='Current folder'
        className='min-w-0'
      >
        <ol className='flex min-w-0 flex-wrap items-center gap-x-1 text-sm'>
          {pathParts.map((part, index) => {
            const path = runtimePathForPartIndex(pathParts, index)
            return (
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
                    {part}
                  </span>
                ) : (
                  <Button
                    type='button'
                    size='sm'
                    variant='bare'
                    className='h-auto min-w-0 whitespace-normal break-all px-1 text-left text-foreground-muted'
                    disabled={disabled}
                    onClick={() => onPathChange(path)}
                  >
                    {part}
                  </Button>
                )}
              </li>
            )
          })}
        </ol>
      </nav>
    </div>
  )
}
