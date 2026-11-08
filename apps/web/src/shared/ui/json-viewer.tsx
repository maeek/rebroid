'use client'

/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Keyboard users need to focus the scrollable code region. */

import { useState, useTransition } from 'react'
import { IconCopy, IconTextWrap } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { MutationButton } from '@/components/ui/mutation-button'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { editorSectionClassName } from '@/components/ui/surface'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const JsonTokens = ({ output }: { output: string }) => (
  <>
    {output
      .split(/("(?:[^"\\]|\\.)*"\s*:|"(?:[^"\\]|\\.)*"|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g)
      .map((token, index) => {
        let color = 'text-foreground-muted'
        if (token.startsWith('"')) color = token.trimEnd().endsWith(':') ? 'text-primary' : 'text-foreground'
        else if (/^(true|false|null)$/.test(token)) color = 'text-warning'
        else if (/^-?\d/.test(token)) color = 'text-info'
        return (
          <span
            key={index}
            className={color}
          >
            {token}
          </span>
        )
      })}
  </>
)

export const JsonViewer = ({
  value,
  title = 'JSON',
  className,
  loading = false
}: {
  value: unknown
  title?: string
  className?: string
  loading?: boolean
}) => {
  const [wrap, setWrap] = useState(true)
  const [copying, startCopy] = useTransition()
  const output = JSON.stringify(value, null, 2) ?? 'null'

  return (
    <Section
      surface='plain'
      title={title}
      className={cn(editorSectionClassName, className)}
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
                  toast({ title: 'JSON copied', variant: 'success' })
                } catch {
                  toast({ title: 'Could not copy JSON', variant: 'danger' })
                }
              })
            }
          >
            <IconCopy className='size-4' /> Copy
          </MutationButton>
        </>
      }
    >
      {}
      <div
        tabIndex={0}
        role='region'
        aria-label={`${title} JSON`}
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
              aria-label='Loading JSON'
            >
              {Array.from({ length: 12 }, (_, index) => (
                <Skeleton
                  key={index}
                  className='h-4 w-3/4'
                />
              ))}
            </span>
          ) : (
            <code>
              <JsonTokens output={output} />
            </code>
          )}
        </pre>
      </div>
    </Section>
  )
}
