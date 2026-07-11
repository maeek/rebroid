import { IconFile, IconFolder } from '@tabler/icons-react'
import { runtimeFileEntryDetail } from './downloads-tools-section-model'
import type { ApplicationRuntimeFile } from '@/server/orchestrator/applications/types'

export const RuntimeFileTiles = ({
  files,
  onDownload,
  onPathChange
}: {
  files: ApplicationRuntimeFile[]
  onDownload: (file: ApplicationRuntimeFile) => void
  onPathChange: (path: string) => void
}) => (
  <div className='grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4'>
    {files.map(entry => (
      <button
        key={entry.path}
        type='button'
        className='flex min-w-0 flex-col items-center gap-2 rounded-control border border-surface-border/60 bg-surface-band/35 px-3 py-4 text-center hover:bg-accent/50'
        onClick={() => (entry.type === 'directory' ? onPathChange(entry.path) : onDownload(entry))}
      >
        {entry.type === 'directory' ? (
          <IconFolder className='size-8 text-primary' />
        ) : (
          <IconFile className='size-8 text-foreground-muted' />
        )}
        <span className='w-full truncate text-sm font-medium'>{entry.name}</span>
        <span className='text-xs text-foreground-muted'>{runtimeFileEntryDetail(entry)}</span>
      </button>
    ))}
  </div>
)
