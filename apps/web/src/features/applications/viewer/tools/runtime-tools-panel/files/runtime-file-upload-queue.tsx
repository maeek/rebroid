'use client'

import { useEffect, useState } from 'react'
import { IconCheck, IconRotate, IconX } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { OperationProgress } from '@/components/ui/operation-progress'
import { Section } from '@/components/ui/section'
import { StateTransition } from '@/components/ui/state-transition'
import { cn } from '@/lib/utils'
import type { RuntimeFileUploadItem } from './use-runtime-file-uploads'

const uploadStatusLabel = (item: RuntimeFileUploadItem) => {
  if (item.status === 'uploading') return item.progress >= 100 ? 'Processing…' : `${item.progress}%`
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
    <Section
      surface='panel'
      title='Upload queue'
      summary={activeCount > 0 ? `${activeCount} upload${activeCount === 1 ? '' : 's'} in progress` : undefined}
      headingLevel={3}
      headingSpacing='compact'
      collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className='sticky bottom-0 z-20'
    >
      <ul
        className='scrollbar-thin max-h-56 min-w-0 divide-y divide-surface-border/60 overflow-y-auto transform-gpu'
        aria-live='polite'
      >
        {items.map(item => (
          <li
            key={item.id}
            className='grid min-w-0 gap-2 py-2 first:pt-0 last:pb-0'
          >
            <div className='flex min-w-0 items-center gap-3'>
              <span className='min-w-0 flex-1'>
                <span className='block wrap-anywhere text-sm font-medium'>{item.file.name}</span>
                <span
                  className={cn('block text-xs text-foreground-muted', {
                    'text-danger': item.status === 'failed',
                    'text-warning': item.status === 'conflict'
                  })}
                >
                  <StateTransition
                    identity={item.id}
                    state={item.status}
                    className='flex'
                  >
                    {item.status === 'completed' ? (
                      <IconCheck
                        aria-hidden
                        className='size-3.5 shrink-0 text-success'
                      />
                    ) : null}
                    <span className='wrap-anywhere'>{item.error ?? uploadStatusLabel(item)}</span>
                  </StateTransition>
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
              <OperationProgress
                label={`Upload progress for ${item.file.name}`}
                value={item.progress}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  )
}
