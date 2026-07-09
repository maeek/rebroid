import { IconDownload, IconFile, IconFolder } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { runtimeFileEntrySubtitle } from './downloads-tools-section-model'
import type { ApplicationRuntimeFile } from '@/server/orchestrator/applications/types'

export const RuntimeFileList = ({
  files,
  onDownload,
  onPathChange
}: {
  files: ApplicationRuntimeFile[]
  onDownload: (file: ApplicationRuntimeFile) => void
  onPathChange: (path: string) => void
}) => (
  <div className='divide-y divide-border/55'>
    {files.map(entry => (
      <div
        key={entry.path}
        className='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-sm'
      >
        <button
          type='button'
          className='flex min-w-0 items-center gap-3 text-left'
          onClick={() => (entry.type === 'directory' ? onPathChange(entry.path) : onDownload(entry))}
        >
          {entry.type === 'directory' ? (
            <IconFolder className='size-5 shrink-0 text-primary' />
          ) : (
            <IconFile className='size-5 shrink-0 text-muted-foreground' />
          )}
          <span className='min-w-0'>
            <span className='block truncate font-medium hover:underline'>{entry.name}</span>
            <span className='block text-xs text-foreground-muted'>{runtimeFileEntrySubtitle(entry)}</span>
          </span>
        </button>
        {entry.type === 'file' ? (
          <Button
            type='button'
            size='sm'
            variant='outline'
            onClick={() => onDownload(entry)}
            aria-label={`Download ${entry.name}`}
          >
            <IconDownload className='size-4' />
          </Button>
        ) : null}
      </div>
    ))}
  </div>
)
