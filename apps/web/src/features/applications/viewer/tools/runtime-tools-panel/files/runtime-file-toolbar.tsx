import { IconArrowUp, IconLayoutGrid, IconList, IconLoader2, IconRefresh } from '@tabler/icons-react'
import classNames from 'classnames'
import { Button } from '@/components/ui/button'
import {
  parentRuntimePath,
  runtimeFilesRootPath,
  runtimePathForPartIndex,
  runtimePathParts,
  type BrowserView
} from './downloads-tools-section-model'

export const RuntimeFileToolbar = ({
  currentPath,
  isRefreshingFiles,
  onPathChange,
  onRefresh,
  onViewChange,
  view
}: {
  currentPath: string
  isRefreshingFiles: boolean
  onPathChange: (path: string) => void
  onRefresh: () => void
  onViewChange: (view: BrowserView) => void
  view: BrowserView
}) => {
  const pathParts = runtimePathParts(currentPath)

  return (
    <div className='flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3'>
      <div className='flex min-w-0 items-center gap-1 text-sm'>
        {pathParts.map((part, index) => {
          const path = runtimePathForPartIndex(pathParts, index)
          const active = path === currentPath
          return (
            <span
              key={path}
              className='flex min-w-0 items-center gap-1'
            >
              {index > 0 ? <span className='text-muted-foreground'>/</span> : null}
              <button
                type='button'
                className={classNames(
                  'truncate',
                  active ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
                disabled={active}
                onClick={() => onPathChange(path)}
              >
                {part}
              </button>
            </span>
          )
        })}
      </div>
      <div className='flex items-center gap-1'>
        <Button
          type='button'
          size='sm'
          variant='ghost'
          disabled={currentPath === runtimeFilesRootPath}
          onClick={() => onPathChange(parentRuntimePath(currentPath))}
          aria-label='Go to parent folder'
        >
          <IconArrowUp className='size-4' />
        </Button>
        <Button
          type='button'
          size='sm'
          variant={view === 'list' ? 'secondary' : 'ghost'}
          onClick={() => onViewChange('list')}
          aria-label='List view'
        >
          <IconList className='size-4' />
        </Button>
        <Button
          type='button'
          size='sm'
          variant={view === 'tiles' ? 'secondary' : 'ghost'}
          onClick={() => onViewChange('tiles')}
          aria-label='Tile view'
        >
          <IconLayoutGrid className='size-4' />
        </Button>
        <Button
          type='button'
          size='sm'
          variant='ghost'
          disabled={isRefreshingFiles}
          onClick={onRefresh}
        >
          {isRefreshingFiles ? <IconLoader2 className='size-4 animate-spin' /> : <IconRefresh className='size-4' />}
          Refresh
        </Button>
      </div>
    </div>
  )
}
