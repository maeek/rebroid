'use client'

import { useEffect, useMemo, useState } from 'react'
import { IconAlertTriangle, IconBlocks } from '@tabler/icons-react'
import dynamic from 'next/dynamic'
import { parse, stringify } from 'yaml'
import { Button } from '@/components/ui/button'
import { getActionUiStateFromInput, normalizeActionInput } from '../../actions/action-registry'
import { buildAutomationActionInputYamlSchema } from '../../editor/monaco-yaml'
import type { AutomationActionStepForm } from '../../editor/builder-utils'
import type { AutomationCommand } from '@/server/orchestrator/automations/types'

const AutomationMonacoYamlEditor = dynamic(
  () => import('../../editor/monaco-yaml').then(module => module.AutomationMonacoYamlEditor),
  {
    ssr: false,
    loading: () => <div className='h-72 rounded-md border border-border/60 bg-background/25' />
  }
)

export function AutomationStepYamlEditor({
  step,
  command,
  onChange,
  onBack
}: {
  step: AutomationActionStepForm
  command?: AutomationCommand
  onChange: (step: AutomationActionStepForm) => void
  onBack: () => void
}) {
  const [yaml, setYaml] = useState(() => stringify(parseStepInput(step), { lineWidth: 0 }).trimEnd())
  const [error, setError] = useState<string | null>(null)
  const [schemaValid, setSchemaValid] = useState(true)
  const schema = useMemo(() => buildAutomationActionInputYamlSchema(command), [command])
  const modelUri = useMemo(() => `file:///rebroid-action-${step.clientKey.replaceAll(':', '-')}.yaml`, [step.clientKey])

  useEffect(() => {
    setYaml(stringify(parseStepInput(step), { lineWidth: 0 }).trimEnd())
  }, [step])

  const changeYaml = (nextYaml: string) => {
    setYaml(nextYaml)
    try {
      const parsed = parse(nextYaml || '{}') as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Step input must be a YAML object.')
      }
      const normalized = normalizeActionInput(step.uses, parsed as Record<string, unknown>)
      setError(null)
      onChange({
        ...step,
        withJson: JSON.stringify(normalized, null, 2),
        uiState: { ...(step.uiState ?? {}), ...getActionUiStateFromInput(step.uses, normalized) }
      })
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'Invalid YAML.')
    }
  }

  const valid = !error && schemaValid

  return (
    <div className='grid gap-3'>
      <div className='flex items-center justify-between gap-3'>
        <div className='text-sm font-medium'>YAML input</div>
        <Button
          type='button'
          size='sm'
          variant='secondary'
          disabled={!valid}
          onClick={onBack}
        >
          <IconBlocks className='size-4' />
          Blocks
        </Button>
      </div>
      <AutomationMonacoYamlEditor
        value={yaml}
        schema={schema}
        modelUri={modelUri}
        ariaLabel='Step input YAML'
        className='h-72 min-h-72'
        onChange={changeYaml}
        onValidationChange={(nextValid: boolean, messages: string[]) => {
          setSchemaValid(nextValid)
          if (!nextValid && messages[0]) setError(messages[0])
          else if (nextValid && error && canParseYamlObject(yaml)) setError(null)
        }}
      />
      {error ? (
        <div className='flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive'>
          <IconAlertTriangle className='mt-0.5 size-4 shrink-0' />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  )
}

const parseStepInput = (step: AutomationActionStepForm) => {
  try {
    const parsed: unknown = JSON.parse(step.withJson || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

const canParseYamlObject = (yaml: string) => {
  try {
    const parsed = parse(yaml || '{}') as unknown
    return !!parsed && typeof parsed === 'object' && !Array.isArray(parsed)
  } catch {
    return false
  }
}
