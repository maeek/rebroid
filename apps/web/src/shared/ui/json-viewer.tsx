'use client'

import { useState } from 'react'
import { IconCheck, IconCopy, IconTextWrap } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const JsonViewer = ({ value, className }: { value: unknown; className?: string }) => {
  const [wrap, setWrap] = useState(false)
  const [copied, setCopied] = useState(false)
  const output = JSON.stringify(value, null, 2)

  const copy = async () => {
    await navigator.clipboard.writeText(output)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={cn('overflow-hidden rounded-panel border border-surface-border/60 bg-surface-band/45', className)}>
      <div className='flex items-center justify-end gap-1 border-b border-surface-border/60 px-2 py-1.5'>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          aria-pressed={wrap}
          onClick={() => setWrap(current => !current)}
        >
          <IconTextWrap className='size-4' />
          Wrap
        </Button>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          onClick={() => void copy()}
        >
          {copied ? <IconCheck className='size-4 text-success' /> : <IconCopy className='size-4' />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre
        className={cn('max-h-[32rem] overflow-auto p-4 font-mono text-xs leading-6 text-foreground-muted', {
          'whitespace-pre-wrap break-all': wrap
        })}
      >
        {output}
      </pre>
    </div>
  )
}
