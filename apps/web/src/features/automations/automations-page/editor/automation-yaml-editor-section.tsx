'use client'

import dynamic from 'next/dynamic'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { AutomationCommand } from '@/shared/contracts/automation'

const AutomationMonacoYamlEditor = dynamic(
  () => import('./monaco-yaml/automation-monaco-yaml-editor').then(module => module.AutomationMonacoYamlEditor),
  {
    ssr: false,
    loading: () => <Skeleton className='h-136 w-full' />
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
    <Section
      surface='panel'
      className={cn('min-h-0 min-w-0', className)}
    >
      <AutomationMonacoYamlEditor
        value={yaml}
        commands={commands}
        className='min-h-112 w-full flex-1'
        onChange={onYamlChange}
        onValidationChange={onValidationChange}
      />
    </Section>
  )
}
