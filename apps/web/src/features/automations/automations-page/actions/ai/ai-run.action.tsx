'use client'

import { useCallback, useMemo } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { AiModelPickerFields, AiModelPickerHealthFooter } from '@/shared/ui/ai/ai-model-picker-parts'
import { useAiModelCatalogSelection } from '@/shared/ui/ai/use-ai-model-catalog-selection'
import { NumberField, TextareaField } from '../shared/action-fields'
import {
  booleanValue,
  defaultAiRunInput,
  nextAllowedAiRunTools,
  normalizeAiRunInput,
  numberValue,
  selectableAiRunCommands,
  stringArrayValue,
  stringValue,
  summarizeAiRunInput
} from './ai-run.model'
import type { AutomationActionDefinition } from '../automation-action-definition'

export const aiRunAction: AutomationActionDefinition = {
  uses: 'ai.run',
  category: 'AI',
  iconKey: 'sparkles',
  label: 'AI run',
  description: 'Runs an AI harness that can call permitted automation tools to satisfy a prompt.',
  defaultInput: defaultAiRunInput,
  normalizeInput: normalizeAiRunInput,
  summary: summarizeAiRunInput,
  renderEditor: props => <AiRunEditor {...props} />
}

const AiRunEditor = ({ commands, input, patchInput }: Parameters<AutomationActionDefinition['renderEditor']>[0]) => {
  const providerId = stringValue(input, 'providerId')
  const modelId = stringValue(input, 'modelId')
  const visionProviderId = stringValue(input, 'visionProviderId')
  const visionModelId = stringValue(input, 'visionModelId')
  const allowedTools = stringArrayValue(input, 'allowedTools')
  const selectableCommands = useMemo(() => selectableAiRunCommands(commands), [commands])
  const loadCatalog = useCallback(
    () =>
      import('@/server/orchestrator/settings/actions').then(({ listAutomationAiModelCatalogAction }) =>
        listAutomationAiModelCatalogAction()
      ),
    []
  )
  const checkPlannerHealth = useCallback(
    (nextProviderId: string, nextModelId: string) =>
      import('@/server/orchestrator/settings/actions').then(({ checkAutomationAiProviderHealthAction }) =>
        checkAutomationAiProviderHealthAction(nextProviderId, nextModelId, 'planner')
      ),
    []
  )
  const modelSelection = useAiModelCatalogSelection({
    checkHealth: checkPlannerHealth,
    loadCatalog,
    modelId,
    onSelectionChange: patchInput,
    providerId,
    visionModelId,
    visionPatchMode: 'missing',
    visionProviderId
  })

  const toggleTool = (uses: string, enabled: boolean) => {
    patchInput({ allowedTools: nextAllowedAiRunTools({ allowedTools, commands: selectableCommands, enabled, uses }) })
  }

  return (
    <div className='grid gap-5'>
      <TextareaField
        label='Prompt'
        value={stringValue(input, 'prompt')}
        onChange={prompt => patchInput({ prompt })}
      />
      <AiModelPickerFields
        catalog={modelSelection.plannerCatalog}
        selectedProvider={modelSelection.selectedProvider}
        selectedModel={modelSelection.selectedModel}
        selectedVisionProvider={modelSelection.selectedVisionProvider}
        selectedVisionModel={modelSelection.selectedVisionModel}
        visionCatalog={modelSelection.visionCatalog}
        isLoadingCatalog={modelSelection.isLoadingCatalog}
        onProviderChange={modelSelection.setProviderId}
        onModelChange={modelSelection.setModelId}
        onVisionProviderChange={modelSelection.setVisionProviderId}
        onVisionModelChange={modelSelection.setVisionModelId}
      />
      <AiModelPickerHealthFooter
        health={modelSelection.health}
        isCheckingHealth={modelSelection.isCheckingHealth}
        selectedModel={modelSelection.selectedModel}
        onRecheckHealth={() => void modelSelection.recheckHealth()}
      />
      <div className='grid gap-2'>
        <div className='text-sm font-medium'>Allowed tools</div>
        <div className='scrollbar-thin max-h-56 overflow-x-hidden overflow-y-auto rounded-control border border-surface-border/70 bg-surface-band/35 p-3'>
          <div className='grid grid-cols-[repeat(auto-fit,minmax(min(15rem,100%),1fr))] gap-2'>
            {selectableCommands.map(command => {
              const checked = allowedTools.length === 0 || allowedTools.includes(command.uses)
              return (
                <label
                  htmlFor={`ai-run-tool-${command.uses}`}
                  key={command.uses}
                  className='flex min-w-0 items-start gap-2 rounded-control px-2 py-1 text-sm hover:bg-white/7'
                >
                  <Checkbox
                    id={`ai-run-tool-${command.uses}`}
                    checked={checked}
                    onCheckedChange={value => toggleTool(command.uses, value === true)}
                  />
                  <span className='min-w-0'>
                    <span className='block truncate font-medium'>{command.label}</span>
                    <span className='block truncate text-xs text-foreground-muted'>{command.uses}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </div>
        <p className='text-xs text-foreground-muted'>All tools are allowed until one tool is unchecked.</p>
      </div>
      <div className='grid grid-cols-[repeat(auto-fit,minmax(min(14rem,100%),1fr))] gap-4'>
        <NumberField
          label='Max tool calls'
          value={numberValue(input, 'maxToolCalls', 20)}
          onChange={maxToolCalls => patchInput({ maxToolCalls })}
        />
        <NumberField
          label='Timeout'
          value={numberValue(input, 'timeoutMs', 120000)}
          suffix='ms'
          onChange={timeoutMs => patchInput({ timeoutMs })}
        />
        <label
          htmlFor='ai-run-require-final-answer'
          className='flex items-center justify-between gap-3 rounded-control border border-surface-border/70 bg-surface-band/35 px-3 py-2 min-[42rem]:col-span-full'
        >
          <span>
            <span className='block text-sm font-medium'>Require final answer</span>
            <span className='block text-xs text-foreground-muted'>
              Fail when the AI stops without a visible summary.
            </span>
          </span>
          <Checkbox
            id='ai-run-require-final-answer'
            checked={booleanValue(input, 'requireFinalAnswer', true)}
            onCheckedChange={value => patchInput({ requireFinalAnswer: value === true })}
          />
        </label>
      </div>
    </div>
  )
}
