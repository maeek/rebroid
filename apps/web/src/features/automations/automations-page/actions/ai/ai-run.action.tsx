'use client'

import { useCallback, useMemo } from 'react'
import { hasActionInputBinding } from '@rebroid/automation-core/command-registry'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { AiModelPickerFields, AiModelPickerHealthFooter } from '@/shared/ui/ai/ai-model-picker-parts'
import { useAiModelCatalogSelection } from '@/shared/ui/ai/use-ai-model-catalog-selection'
import { NumberField, SelectField, TextareaField } from '../shared/action-fields'
import {
  defaultAiRunCapabilities,
  defaultAiRunInput,
  nextAiRunCapabilities,
  numberValue,
  selectableAiRunCommands,
  stringArrayValue,
  stringValue,
  summarizeAiRunInput
} from './ai-run.model'
import type { AutomationActionDefinition } from '../automation-action-definition'
import type { AiModelRole } from '@/shared/model/ai-model-catalog'

export const aiRunAction: AutomationActionDefinition = {
  uses: 'ai.run',
  category: 'AI',
  iconKey: 'sparkles',
  label: 'AI run',
  description: 'Runs an AI harness that can call permitted automation tools to satisfy a prompt.',
  defaultInput: defaultAiRunInput,
  summary: summarizeAiRunInput,
  renderEditor: props => <AiRunEditor {...props} />
}

const AiRunEditor = ({ commands, input, patchInput }: Parameters<AutomationActionDefinition['renderEditor']>[0]) => {
  const providerId = stringValue(input, 'providerId')
  const modelId = stringValue(input, 'modelId')
  const visionProviderId = stringValue(input, 'visionProviderId')
  const visionModelId = stringValue(input, 'visionModelId')
  const capabilities = Array.isArray(input.capabilities) ? stringArrayValue(input, 'capabilities') : undefined
  const canAllowShell = commands.some(command => command.uses === 'android.adbShell')
  const selectableCommands = useMemo(() => selectableAiRunCommands(commands), [commands])
  const selectedCapabilities = capabilities ?? defaultAiRunCapabilities(selectableCommands)
  const loadCatalog = useCallback(
    () =>
      import('@/server/orchestrator/settings/actions').then(({ listAutomationAiModelCatalogAction }) =>
        listAutomationAiModelCatalogAction()
      ),
    []
  )
  const checkModelHealth = useCallback(
    (nextProviderId: string, nextModelId: string, role: AiModelRole) =>
      import('@/server/orchestrator/settings/actions').then(({ checkAutomationAiProviderHealthAction }) =>
        checkAutomationAiProviderHealthAction(nextProviderId, nextModelId, role)
      ),
    []
  )
  const modelSelection = useAiModelCatalogSelection({
    checkHealth: checkModelHealth,
    role: 'controller',
    loadCatalog,
    modelId,
    onSelectionChange: patchInput,
    providerId,
    visionModelId,
    selectionMode: 'explicit',
    visionProviderId
  })
  const unavailableModels = [
    { id: providerId, selected: modelSelection.selectedProvider?.id, label: 'Device control provider' },
    { id: modelId, selected: modelSelection.selectedModel?.id, label: 'Device control model' },
    { id: visionProviderId, selected: modelSelection.selectedVisionProvider?.id, label: 'Vision provider' },
    { id: visionModelId, selected: modelSelection.selectedVisionModel?.id, label: 'Vision model' }
  ].filter(({ id, selected }) => id && id !== selected)

  const toggleTool = (uses: string, enabled: boolean) => {
    patchInput({ capabilities: nextAiRunCapabilities({ capabilities, commands: selectableCommands, enabled, uses }) })
  }

  return (
    <div className='grid gap-5'>
      {!hasActionInputBinding(input.prompt) && (
        <TextareaField
          label='Prompt'
          value={stringValue(input, 'prompt')}
          onChange={prompt => patchInput({ prompt })}
        />
      )}
      {!modelSelection.isLoadingCatalog && unavailableModels.length > 0 && (
        <p
          className='text-sm text-foreground-muted'
          role='status'
        >
          Unavailable in the model catalog {unavailableModels.map(({ id, label }) => `${label} “${id}”`).join(', ')}.
        </p>
      )}
      <AiModelPickerFields
        catalog={modelSelection.primaryCatalog}
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
        <div className='flex items-center justify-between gap-2'>
          <div className='text-sm font-medium'>Allowed capabilities</div>
          {capabilities !== undefined && (
            <Button
              type='button'
              size='sm'
              variant='ghost'
              onClick={() => patchInput({ capabilities: undefined })}
            >
              Use defaults
            </Button>
          )}
        </div>
        <div className='scrollbar-thin max-h-56 overflow-x-hidden overflow-y-auto rounded-control border border-surface-border/70 bg-surface-band/35 p-3'>
          <div className='grid grid-cols-[repeat(auto-fit,minmax(min(15rem,100%),1fr))] gap-2'>
            {selectableCommands.map(command => {
              const checked = selectedCapabilities.includes(command.uses)
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
        <p className='text-xs text-foreground-muted'>
          Defaults follow your permissions. The agent receives up to five relevant routed capabilities per run.
        </p>
      </div>
      <div className='grid grid-cols-[repeat(auto-fit,minmax(min(14rem,100%),1fr))] gap-x-form-column gap-y-4'>
        <SelectField
          label='Agent mode'
          value={stringValue(input, 'agentMode') || 'adaptive'}
          options={[
            { value: 'adaptive', label: 'Adaptive' },
            { value: 'controller', label: 'Controller' },
            { value: 'planned', label: 'Planned' }
          ]}
          onChange={agentMode => patchInput({ agentMode })}
        />
        {(input.rawShellPolicy === 'allowlisted' || canAllowShell) && (
          <SelectField
            label='Read-only shell escalation'
            value={stringValue(input, 'rawShellPolicy') || 'deny'}
            options={[
              { value: 'deny', label: 'Deny' },
              ...(canAllowShell ? [{ value: 'allowlisted', label: 'Allow listed commands' }] : [])
            ]}
            onChange={rawShellPolicy => patchInput({ rawShellPolicy })}
          />
        )}
        <NumberField
          label='Max actions'
          value={numberValue(input, 'maxActions', 20)}
          onChange={maxActions => patchInput({ maxActions })}
        />
        <NumberField
          label='Timeout'
          value={numberValue(input, 'timeoutMs', 120000)}
          suffix='ms'
          onChange={timeoutMs => patchInput({ timeoutMs })}
        />
      </div>
    </div>
  )
}
