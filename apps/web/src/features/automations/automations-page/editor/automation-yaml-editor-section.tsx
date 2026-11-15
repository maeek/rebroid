'use client'

import dynamic from 'next/dynamic'
import { Notice } from '@/components/ui/notice'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { AutomationCommand } from '@/shared/contracts/automation'

const AutomationMonacoYamlEditor = dynamic(
  () => import('./monaco-yaml/automation-monaco-yaml-editor').then(module => module.AutomationMonacoYamlEditor),
  {
    ssr: false,
    loading: () => <Skeleton className='h-full w-full rounded-none' />
  }
)

export function AutomationYamlEditorSection({
  yaml,
  commands,
  onYamlChange,
  error = null,
  pending = false,
  className
}: {
  yaml: string
  commands: AutomationCommand[]
  onYamlChange: (yaml: string) => void
  error?: string | null
  pending?: boolean
  className?: string
}) {
  return (
    <section
      aria-label='Workflow YAML'
      className={cn(
        'grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)] gap-2 has-[>footer]:grid-rows-[minmax(0,1fr)_auto]',
        className
      )}
    >
      <div className='relative min-h-0 min-w-0'>
        <AutomationMonacoYamlEditor
          value={yaml}
          commands={commands}
          className='min-h-0 resize-none rounded-none! border-0 bg-background [&_.margin]:bg-background [&_.monaco-editor]:bg-background [&_.monaco-editor-background]:bg-background'
          onChange={onYamlChange}
        />
      </div>
      {pending || error ? (
        <footer className='grid gap-2'>
          {pending && (
            <p
              className='text-sm text-foreground-muted'
              role='status'
            >
              Checking workflow YAML…
            </p>
          )}
          {error && (
            <Notice
              tone='danger'
              className='max-h-32 overflow-y-auto'
            >
              {error}
            </Notice>
          )}
        </footer>
      ) : null}
    </section>
  )
}
