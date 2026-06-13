'use client'

import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import type { AutomationCommand } from '@/server/orchestrator/automations/types'

const AutomationMonacoYamlEditor = dynamic(
  () => import('./monaco-yaml').then(module => module.AutomationMonacoYamlEditor),
  {
    ssr: false,
    loading: () => <div className='h-136 rounded-md border border-border/60 bg-surface-band/35' />
  }
)

export function AutomationYamlEditorSection({
  yaml,
  commands,
  onYamlChange,
  onValidationChange,
  className
}: {
  yaml: string
  commands: AutomationCommand[]
  onYamlChange: (yaml: string) => void
  onValidationChange: (valid: boolean, messages: string[]) => void
  className?: string
}) {
  return (
    <section className={cn('flex min-h-0 min-w-0 flex-col gap-3', className)}>
      <div className='flex h-8 items-center justify-between gap-3'>
        <h3 className='text-xl font-medium'>YAML</h3>
      </div>
      <AutomationMonacoYamlEditor
        value={yaml}
        commands={commands}
        className='min-h-112 flex-1'
        onChange={onYamlChange}
        onValidationChange={onValidationChange}
      />
    </section>
  )
}
