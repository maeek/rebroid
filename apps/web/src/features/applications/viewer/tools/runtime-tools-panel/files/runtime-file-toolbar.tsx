import {
  IconArrowUp,
  IconArrowsSort,
  IconFolderPlus,
  IconLoader2,
  IconRefresh,
  IconSearch,
  IconUpload
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  parentRuntimePath,
  runtimeFilesRootPath,
  runtimePathForPartIndex,
  runtimePathParts,
  type RuntimeFileSort,
  type RuntimeFileSortDirection
} from './downloads-tools-section-model'

export const RuntimeFileToolbar = ({
  canManageFiles,
  currentPath,
  isRefreshing,
  onBrowse,
  onCreateFolder,
  onPathChange,
  onRefresh,
  onSearchChange,
  onSortChange,
  onSortDirectionChange,
  onUpload,
  searchQuery,
  sort,
  sortDirection
}: {
  canManageFiles: boolean
  currentPath: string
  isRefreshing: boolean
  onBrowse: () => void
  onCreateFolder: () => void
  onPathChange: (path: string) => void
  onRefresh: () => void
  onSearchChange: (value: string) => void
  onSortChange: (value: RuntimeFileSort) => void
  onSortDirectionChange: (value: RuntimeFileSortDirection) => void
  onUpload: () => void
  searchQuery: string
  sort: RuntimeFileSort
  sortDirection: RuntimeFileSortDirection
}) => {
  const pathParts = runtimePathParts(currentPath)

  return (
    <div className='grid gap-3 border-b border-surface-border/60 px-3 py-3 max-sm:[&_button]:min-h-11 sm:px-4'>
      <div className='flex min-w-0 items-center justify-between gap-3'>
        <div className='scrollbar-thin flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap text-sm'>
          {pathParts.map((part, index) => {
            const path = runtimePathForPartIndex(pathParts, index)
            const active = path === currentPath
            return (
              <span
                key={path}
                className='flex min-w-0 items-center gap-1'
              >
                <span className='text-foreground-muted'>/</span>
                <Button
                  type='button'
                  size='sm'
                  variant='bare'
                  className={cn('h-8 px-1', active ? 'text-foreground' : 'text-foreground-muted')}
                  disabled={active}
                  onClick={() => onPathChange(path)}
                >
                  {part}
                </Button>
              </span>
            )
          })}
        </div>
        <Button
          type='button'
          size='sm'
          onClick={onUpload}
        >
          <IconUpload className='size-4' />
          <span className='hidden sm:inline'>Upload files</span>
          <span className='sm:hidden'>Upload</span>
        </Button>
      </div>

      <div className='flex flex-wrap items-center gap-2'>
        <Button
          type='button'
          size='sm'
          variant='outline'
          className='lg:hidden'
          onClick={onBrowse}
        >
          Browse
        </Button>
        <Button
          type='button'
          size='icon-sm'
          variant='ghost'
          disabled={currentPath === runtimeFilesRootPath}
          onClick={() => onPathChange(parentRuntimePath(currentPath))}
          aria-label='Go to parent folder'
        >
          <IconArrowUp className='size-4' />
        </Button>
        <div className='relative min-w-44 flex-1 sm:max-w-72'>
          <IconSearch className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-muted' />
          <Input
            value={searchQuery}
            className='pl-9 max-sm:min-h-11'
            placeholder='Search this folder'
            aria-label='Search this folder'
            onChange={event => onSearchChange(event.target.value)}
          />
        </div>
        <Select
          value={sort}
          onValueChange={onSortChange}
        >
          <SelectTrigger
            size='sm'
            className='w-28 max-sm:min-h-11'
            aria-label='Sort files by'
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align='end'>
            <SelectItem value='name'>Name</SelectItem>
            <SelectItem value='modified'>Modified</SelectItem>
            <SelectItem value='size'>Size</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type='button'
          size='icon-sm'
          variant='ghost'
          onClick={() => onSortDirectionChange(sortDirection === 'asc' ? 'desc' : 'asc')}
          aria-label={sortDirection === 'asc' ? 'Sort descending' : 'Sort ascending'}
        >
          <IconArrowsSort className='size-4' />
        </Button>
        {canManageFiles ? (
          <Button
            type='button'
            size='icon-sm'
            variant='ghost'
            onClick={onCreateFolder}
            aria-label='Create folder'
          >
            <IconFolderPlus className='size-4' />
          </Button>
        ) : null}
        <Button
          type='button'
          size='icon-sm'
          variant='ghost'
          disabled={isRefreshing}
          onClick={onRefresh}
          aria-label='Refresh files'
        >
          {isRefreshing ? <IconLoader2 className='size-4 animate-spin' /> : <IconRefresh className='size-4' />}
        </Button>
      </div>
    </div>
  )
}
