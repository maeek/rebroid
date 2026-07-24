'use client'

import { useEffect, useState } from 'react'
import { IconChevronDown, IconChevronUp, IconRotate, IconUpload, IconX } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { RuntimeFileUploadItem } from './use-runtime-file-uploads'

const uploadStatusLabel = (item: RuntimeFileUploadItem) => {
  if (item.status === 'uploading') return `${item.progress}%`
  if (item.status === 'conflict') return 'File already exists'
  if (item.status === 'failed') return 'Failed'
  if (item.status === 'completed') return 'Complete'
  if (item.status === 'canceled') return 'Canceled'
  return 'Queued'
}

export const RuntimeFileUploadQueue = ({
  activeCount,
  items,
  onCancel,
  onDismiss,
  onRetry
}: {
  activeCount: number
  items: RuntimeFileUploadItem[]
  onCancel: (id: string) => void
  onDismiss: (id: string) => void
  onRetry: (id: string, overwrite?: boolean) => void
}) => {
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    if (items.some(item => item.status === 'conflict' || item.status === 'failed')) setExpanded(true)
  }, [items])

  if (items.length === 0) return null

  return (
    <div
      className='sticky bottom-0 z-20 border-t border-surface-border/70 bg-surface-elevated/95 shadow-floating max-sm:[&_button]:min-h-11 supports-[backdrop-filter]:backdrop-blur-xl'
      aria-live='polite'
    >
      <Button
        type='button'
        variant='bare'
        className='min-h-11 w-full justify-between px-4 text-left'
        onClick={() => setExpanded(value => !value)}
        aria-expanded={expanded}
      >
        <span className='flex items-center gap-2'>
          <IconUpload className='size-4 text-primary' />
          {activeCount > 0 ? `${activeCount} upload${activeCount === 1 ? '' : 's'} in progress` : 'Upload queue'}
        </span>
        {expanded ? <IconChevronDown className='size-4' /> : <IconChevronUp className='size-4' />}
      </Button>
      {expanded ? (
        <div className='scrollbar-thin grid max-h-56 gap-2 overflow-y-auto border-t border-surface-border/60 px-3 pt-3 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 sm:pb-3'>
          {items.map(item => (
            <div
              key={item.id}
              className='grid gap-2 rounded-control border border-surface-border/60 bg-surface-band/55 px-3 py-2'
            >
              <div className='flex min-w-0 items-center gap-3'>
                <span className='min-w-0 flex-1'>
                  <span className='block truncate text-sm font-medium'>{item.file.name}</span>
                  <span
                    className={cn('block truncate text-xs text-foreground-muted', {
                      'text-danger': item.status === 'failed',
                      'text-warning': item.status === 'conflict'
                    })}
                  >
                    {item.error ?? uploadStatusLabel(item)}
                  </span>
                </span>
                {item.status === 'queued' || item.status === 'uploading' ? (
                  <Button
                    type='button'
                    size='icon-sm'
                    variant='ghost'
                    onClick={() => onCancel(item.id)}
                    aria-label={`Cancel ${item.file.name}`}
                  >
                    <IconX className='size-4' />
                  </Button>
                ) : null}
                {item.status === 'failed' ? (
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    onClick={() => onRetry(item.id)}
                  >
                    <IconRotate className='size-4' />
                    Retry
                  </Button>
                ) : null}
                {item.status === 'conflict' ? (
                  <div className='flex items-center gap-1'>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      onClick={() => onDismiss(item.id)}
                    >
                      Skip
                    </Button>
                    <Button
                      type='button'
                      size='sm'
                      onClick={() => onRetry(item.id, true)}
                    >
                      Replace
                    </Button>
                  </div>
                ) : null}
                {item.status === 'completed' || item.status === 'canceled' ? (
                  <Button
                    type='button'
                    size='icon-sm'
                    variant='ghost'
                    onClick={() => onDismiss(item.id)}
                    aria-label={`Dismiss ${item.file.name}`}
                  >
                    <IconX className='size-4' />
                  </Button>
                ) : null}
              </div>
              {item.status === 'uploading' ? (
                <div
                  role='progressbar'
                  aria-label={`Upload progress for ${item.file.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={item.progress}
                  className='h-1.5 overflow-hidden rounded-full bg-surface-border/60'
                >
                  <div
                    className='h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none'
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
