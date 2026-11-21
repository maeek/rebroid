'use client'

import { useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox'
import { automationActionPresentation } from '@/shared/model/workflow-action-presentation'
import { AiModelCatalogFields } from '@/shared/ui/ai/ai-model-catalog-fields'
import { AiModelPickerHealthFooter } from '@/shared/ui/ai/ai-model-picker-parts'
import { useAiModelCatalogSelection } from '@/shared/ui/ai/use-ai-model-catalog-selection'
import { NumberField, SelectField, TextField } from '../shared/action-fields'
import { AdvancedActionFields } from '../shared/advanced-action-fields'
import {
  defaultAiRunCapabilities,
  defaultAiRunInput,
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

  return (
    <div className='grid gap-5'>
      <TextField
        multiline
        field='prompt'
        label='Task for the device agent'
        placeholder='Open Android Settings and verify that the main screen appears…'
        value={stringValue(input, 'prompt')}
        onChange={prompt => patchInput({ prompt })}
      />
      {!modelSelection.isLoadingCatalog && unavailableModels.length > 0 && (
        <p
          className='text-sm text-foreground-muted'
          role='status'
        >
          Unavailable in the model catalog {unavailableModels.map(({ id, label }) => `${label} “${id}”`).join(', ')}.
        </p>
      )}
      <p className='text-sm text-foreground-muted'>
        Device control model: {modelSelection.selectedModel?.id ?? (modelId || 'Workflow default')}
      </p>
      <FormField
        label='Allowed capabilities'
        description='Defaults follow your permissions. The agent receives up to five relevant routed capabilities per run.'
        layout='vertical'
        resetAction={
          capabilities === undefined
            ? undefined
            : {
                label: 'Reset allowed capabilities to defaults',
                onReset: () => patchInput({ capabilities: undefined })
              }
        }
      >
        {capabilities === undefined ? (
          <Button
            type='button'
            variant='secondary'
            size='sm'
            aria-label='Customize capabilities'
            onClick={() => patchInput({ capabilities: selectedCapabilities })}
          >
            Customize capabilities
          </Button>
        ) : (
          <MultiSelectCombobox
            value={selectedCapabilities}
            options={selectableCommands
              .map(command => ({
                value: command.uses,
                label: automationActionPresentation[command.uses]?.[1] ?? command.label,
                description: command.description,
                keywords: [command.uses]
              }))
              .concat(
                selectedCapabilities
                  .filter(uses => !selectableCommands.some(command => command.uses === uses))
                  .map(uses => ({
                    value: uses,
                    label: uses,
                    description: 'Unavailable to this account.',
                    keywords: [uses]
                  }))
              )}
            placeholder='Search capabilities'
            onValueChange={next => patchInput({ capabilities: next })}
          />
        )}
      </FormField>
      <AdvancedActionFields
        label='Models and execution limits'
        summary={providerId || modelId || visionProviderId || visionModelId ? 'Model overrides' : undefined}
        open={unavailableModels.length > 0 && !modelSelection.isLoadingCatalog}
      >
        <div className='grid gap-3'>
          <AiModelCatalogFields
            catalog={modelSelection.primaryCatalog}
            selectedProvider={modelSelection.selectedProvider}
            selectedModel={modelSelection.selectedModel}
            isLoadingCatalog={modelSelection.isLoadingCatalog}
            onProviderChange={modelSelection.selectPrimaryModel}
            onModelChange={nextModelId => patchInput({ modelId: nextModelId })}
          />
          <AiModelCatalogFields
            vision
            catalog={modelSelection.visionCatalog}
            selectedProvider={modelSelection.selectedVisionProvider}
            selectedModel={modelSelection.selectedVisionModel}
            onProviderChange={modelSelection.setVisionProviderId}
            onModelChange={modelSelection.setVisionModelId}
          />
        </div>
        <AiModelPickerHealthFooter
          health={modelSelection.health}
          isCheckingHealth={modelSelection.isCheckingHealth}
          selectedModel={modelSelection.selectedModel}
          onRecheckHealth={() => void modelSelection.recheckHealth()}
        />
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
            field='maxActions'
            label='Maximum actions'
            value={numberValue(input, 'maxActions', 20)}
            onChange={maxActions => patchInput({ maxActions })}
          />
          <NumberField
            field='timeoutMs'
            label='Timeout'
            value={numberValue(input, 'timeoutMs', 120000)}
            suffix='ms'
            onChange={timeoutMs => patchInput({ timeoutMs })}
          />
        </div>
      </AdvancedActionFields>
    </div>
  )
}
