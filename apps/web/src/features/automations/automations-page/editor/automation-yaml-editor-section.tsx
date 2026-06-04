'use client'

import dynamic from 'next/dynamic'
import type { AutomationCommand } from '@/server/orchestrator/automations/types'

const AutomationMonacoYamlEditor = dynamic(
  () => import('./monaco-yaml').then(module => module.AutomationMonacoYamlEditor),
  {
    ssr: false,
    loading: () => <div className='h-[34rem] rounded-md border border-border/60 bg-background/25' />
  }
)

export function AutomationYamlEditorSection({
  yaml,
  commands,
  onYamlChange,
  onValidationChange
}: {
  yaml: string
  commands: AutomationCommand[]
  onYamlChange: (yaml: string) => void
  onValidationChange: (valid: boolean, messages: string[]) => void
}) {
  return (
    <section className='flex min-h-0 min-w-0 flex-col gap-3'>
      <div className='flex h-8 items-center justify-between gap-3'>
        <h3 className='text-xl font-medium'>YAML</h3>
      </div>
      <AutomationMonacoYamlEditor
        value={yaml}
        commands={commands}
        className='min-h-[28rem] flex-1'
        onChange={onYamlChange}
        onValidationChange={onValidationChange}
      />
    </section>
  )
}
