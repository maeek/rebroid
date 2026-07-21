'use client'

import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import type { AutomationCommand } from '@/shared/contracts/automation'

const AutomationMonacoYamlEditor = dynamic(
  () => import('./monaco-yaml/automation-monaco-yaml-editor').then(module => module.AutomationMonacoYamlEditor),
  {
    ssr: false,
    loading: () => <div className='h-136 w-full rounded-control border border-surface-border/60 bg-surface-band/35' />
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
    <section className={cn('flex min-h-0 min-w-0 w-full flex-col gap-3', className)}>
      <div className='flex h-8 items-center justify-between gap-3'>
        <h2 className='text-xl font-medium'>YAML</h2>
      </div>
      <AutomationMonacoYamlEditor
        value={yaml}
        commands={commands}
        className='min-h-112 w-full flex-1'
        onChange={onYamlChange}
        onValidationChange={onValidationChange}
      />
    </section>
  )
}
