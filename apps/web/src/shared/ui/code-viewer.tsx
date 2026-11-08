'use client'

/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Keyboard users need to focus the scrollable code region. */

import { useState, useTransition, type ReactNode } from 'react'
import { IconCopy, IconTextWrap } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { MutationButton } from '@/components/ui/mutation-button'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export const CodeViewer = ({
  output,
  title,
  formatLabel,
  description,
  children,
  className,
  loading = false
}: {
  output: string
  title: string
  formatLabel: string
  description?: ReactNode
  children?: ReactNode
  className?: string
  loading?: boolean
}) => {
  const [wrap, setWrap] = useState(true)
  const [copying, startCopy] = useTransition()

  return (
    <Section
      surface='plain'
      title={title}
      titleClassName='max-sm:flex-col max-sm:gap-3'
      className={className}
      description={description}
      actions={
        <>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            aria-pressed={wrap}
            disabled={loading}
            onClick={() => setWrap(current => !current)}
          >
            <IconTextWrap className='size-4' /> Wrap
          </Button>
          <MutationButton
            type='button'
            variant='ghost'
            size='sm'
            pending={copying}
            disabled={loading}
            pendingLabel='Copying…'
            onClick={() =>
              startCopy(async () => {
                try {
                  await navigator.clipboard.writeText(output)
                  toast({ title: `${formatLabel} copied`, variant: 'success' })
                } catch {
                  toast({ title: `Could not copy ${formatLabel}`, variant: 'danger' })
                }
              })
            }
          >
            <IconCopy className='size-4' /> Copy
          </MutationButton>
        </>
      }
    >
      <div
        tabIndex={0}
        role='region'
        aria-label={`${title} ${formatLabel}`}
        className='max-h-[40rem] min-w-0 overflow-auto rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      >
        <pre
          className={cn(
            'm-0 font-mono text-sm leading-7 tabular-nums',
            wrap ? 'whitespace-pre-wrap [overflow-wrap:anywhere]' : 'whitespace-pre'
          )}
        >
          {loading ? (
            <span
              className='grid gap-3 py-1'
              aria-label={`Loading ${formatLabel}`}
            >
              {Array.from({ length: 12 }, (_, index) => (
                <Skeleton
                  key={index}
                  as='span'
                  className='h-4 w-3/4'
                />
              ))}
            </span>
          ) : (
            <code>{children ?? output}</code>
          )}
        </pre>
      </div>
    </Section>
  )
}
