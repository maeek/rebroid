'use client'

import { useEffect, useState } from 'react'
import { IconDownload, IconFile, IconPencil, IconTrash } from '@tabler/icons-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { runtimeFileCanPreview, runtimeFileEntryDetail } from './downloads-tools-section-model'
import type { ApplicationRuntimeFile } from '@/shared/contracts/application'

export const RuntimeFileInspector = ({
  appId,
  canManageFiles,
  entry,
  onDelete,
  onDownload,
  onRename
}: {
  appId: string
  canManageFiles: boolean
  entry: ApplicationRuntimeFile
  onDelete: (entry: ApplicationRuntimeFile) => void
  onDownload: (entry: ApplicationRuntimeFile) => void
  onRename: (entry: ApplicationRuntimeFile) => void
}) => {
  const [previewFailed, setPreviewFailed] = useState(false)
  const canPreview = runtimeFileCanPreview(entry)
  const query = new URLSearchParams({ path: entry.path, modifiedAt: entry.modifiedAt ?? '' })
  const previewUrl = `/api/bff/applications/${encodeURIComponent(appId)}/runtime/files/preview?${query.toString()}`

  useEffect(() => setPreviewFailed(false), [entry.path, entry.modifiedAt])

  return (
    <div className='grid gap-5'>
      <div>
        <h3 className='break-all text-lg font-medium'>{entry.name}</h3>
        <p className='mt-1 text-xs text-foreground-muted'>{entry.type === 'directory' ? 'Folder' : 'File details'}</p>
      </div>

      {canPreview && !previewFailed ? (
        <div className='relative aspect-video overflow-hidden rounded-control border border-surface-border/60 bg-surface-band'>
          <Image
            fill
            unoptimized
            sizes='320px'
            src={previewUrl}
            alt={`Preview of ${entry.name}`}
            className='object-contain'
            onError={() => setPreviewFailed(true)}
          />
        </div>
      ) : (
        <div className='flex aspect-video items-center justify-center rounded-control border border-surface-border/60 bg-surface-band text-foreground-muted'>
          <IconFile className='size-14' />
        </div>
      )}

      <dl className='grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm'>
        <dt className='text-foreground-muted'>Path</dt>
        <dd className='break-all text-right'>{entry.path}</dd>
        <dt className='text-foreground-muted'>Type</dt>
        <dd className='text-right'>{entry.type === 'directory' ? 'Folder' : 'File'}</dd>
        <dt className='text-foreground-muted'>Size</dt>
        <dd className='text-right'>{runtimeFileEntryDetail(entry)}</dd>
        <dt className='text-foreground-muted'>Modified</dt>
        <dd className='text-right'>{entry.modifiedAt ? new Date(entry.modifiedAt).toLocaleString() : 'Unknown'}</dd>
      </dl>

      <div className='grid gap-2 [&_button]:min-h-11'>
        {entry.type === 'file' ? (
          <Button
            type='button'
            className='w-full'
            onClick={() => onDownload(entry)}
          >
            <IconDownload className='size-4' />
            Download
          </Button>
        ) : null}
        {canManageFiles ? (
          <div className='grid grid-cols-2 gap-2'>
            <Button
              type='button'
              variant='outline'
              onClick={() => onRename(entry)}
            >
              <IconPencil className='size-4' />
              Rename
            </Button>
            <Button
              type='button'
              variant='danger'
              onClick={() => onDelete(entry)}
            >
              <IconTrash className='size-4' />
              Delete
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
