'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { catalogByRole, selectCatalogModel, selectCatalogProvider } from '@/shared/automation/automation-ai-catalog'
import { NumberField, TextareaField } from '../shared/action-fields'
import {
  booleanValue,
  buildAiRunCatalogPatch,
  defaultAiRunInput,
  healthLabel,
  nextAllowedAiRunTools,
  normalizeAiRunInput,
  numberValue,
  selectableAiRunCommands,
  stringArrayValue,
  stringValue,
  summarizeAiRunInput
} from './ai-run.model'
import type { AutomationActionDefinition } from '../automation-action-definition'
import type { AutomationAiModelCatalogProvider, AutomationAiProviderHealth } from '@/server/orchestrator/settings/types'

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
  const [catalog, setCatalog] = useState<AutomationAiModelCatalogProvider[]>([])
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true)
  const [health, setHealth] = useState<AutomationAiProviderHealth | null>(null)
  const [isCheckingHealth, setIsCheckingHealth] = useState(false)
  const patchInputRef = useRef(patchInput)
  const providerId = stringValue(input, 'providerId')
  const plannerCatalog = useMemo(() => catalogByRole(catalog, 'planner'), [catalog])
  const visionCatalog = useMemo(() => catalogByRole(catalog, 'vision'), [catalog])
  const selectedProvider = selectCatalogProvider(plannerCatalog, providerId)
  const modelId = stringValue(input, 'modelId')
  const selectedModel = selectCatalogModel(selectedProvider, modelId)
  const visionProviderId = stringValue(input, 'visionProviderId')
  const selectedVisionProvider = selectCatalogProvider(visionCatalog, visionProviderId)
  const visionModelId = stringValue(input, 'visionModelId')
  const selectedVisionModel = selectCatalogModel(selectedVisionProvider, visionModelId)
  const allowedTools = stringArrayValue(input, 'allowedTools')
  const selectableCommands = useMemo(() => selectableAiRunCommands(commands), [commands])

  useEffect(() => {
    patchInputRef.current = patchInput
  }, [patchInput])

  useEffect(() => {
    let cancelled = false
    setIsLoadingCatalog(true)
    void import('@/server/orchestrator/settings/actions')
      .then(({ listAutomationAiModelCatalogAction }) => listAutomationAiModelCatalogAction())
      .then(nextCatalog => {
        if (cancelled) return
        setCatalog(nextCatalog)
        const patch = buildAiRunCatalogPatch({
          catalog: nextCatalog,
          modelId,
          providerId,
          visionModelId,
          visionProviderId
        })
        if (Object.keys(patch).length > 0) patchInputRef.current(patch)
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCatalog(false)
      })
    return () => {
      cancelled = true
    }
  }, [modelId, providerId, visionModelId, visionProviderId])

  useEffect(() => {
    if (!selectedProvider || !selectedModel) {
      setHealth(null)
      return
    }
    let cancelled = false
    setIsCheckingHealth(true)
    void import('@/server/orchestrator/settings/actions')
      .then(({ checkAutomationAiProviderHealthAction }) =>
        checkAutomationAiProviderHealthAction(selectedProvider.id, selectedModel.id, 'planner')
      )
      .then(result => {
        if (!cancelled) setHealth(result)
      })
      .catch(error => {
        if (cancelled) return
        setHealth({
          providerId: selectedProvider.id,
          modelId: selectedModel.id,
          status: 'error',
          message: error instanceof Error ? error.message : 'Health check failed.',
          checkedAt: new Date().toISOString()
        })
      })
      .finally(() => {
        if (!cancelled) setIsCheckingHealth(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedModel, selectedProvider])

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
      <div className='grid grid-cols-[repeat(auto-fit,minmax(min(16rem,100%),1fr))] gap-4'>
        <div className='grid gap-2'>
          <Label>Planner provider</Label>
          <Select
            value={selectedProvider?.id ?? ''}
            disabled={plannerCatalog.length === 0}
            onValueChange={nextProviderId => {
              const nextProvider = plannerCatalog.find(provider => provider.id === nextProviderId)
              const nextModel = selectCatalogModel(nextProvider, '')
              patchInput({
                providerId: nextProviderId,
                ...(nextModel ? { modelId: nextModel.id } : {})
              })
            }}
          >
            <SelectTrigger className='w-full'>
              <SelectValue placeholder={isLoadingCatalog ? 'Loading providers...' : 'Select planner provider'} />
            </SelectTrigger>
            <SelectContent>
              {plannerCatalog.map(provider => (
                <SelectItem
                  key={provider.id}
                  value={provider.id}
                >
                  {provider.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='grid gap-2'>
          <Label>Planner model</Label>
          <Select
            value={selectedModel?.id ?? ''}
            disabled={!selectedProvider || selectedProvider.models.length === 0}
            onValueChange={nextModelId => patchInput({ modelId: nextModelId })}
          >
            <SelectTrigger className='w-full'>
              <SelectValue placeholder='Select model' />
            </SelectTrigger>
            <SelectContent>
              {(selectedProvider?.models ?? []).map(model => (
                <SelectItem
                  key={model.id}
                  value={model.id}
                >
                  {model.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='grid gap-2'>
          <Label>Vision provider</Label>
          <Select
            value={selectedVisionProvider?.id ?? ''}
            disabled={visionCatalog.length === 0}
            onValueChange={nextProviderId => {
              const nextProvider = visionCatalog.find(provider => provider.id === nextProviderId)
              const nextModel = selectCatalogModel(nextProvider, '')
              patchInput({
                visionProviderId: nextProviderId,
                ...(nextModel ? { visionModelId: nextModel.id } : {})
              })
            }}
          >
            <SelectTrigger className='w-full'>
              <SelectValue placeholder='Optional vision provider' />
            </SelectTrigger>
            <SelectContent>
              {visionCatalog.map(provider => (
                <SelectItem
                  key={provider.id}
                  value={provider.id}
                >
                  {provider.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='grid gap-2'>
          <Label>Vision model</Label>
          <Select
            value={selectedVisionModel?.id ?? ''}
            disabled={!selectedVisionProvider || selectedVisionProvider.models.length === 0}
            onValueChange={nextModelId => patchInput({ visionModelId: nextModelId })}
          >
            <SelectTrigger className='w-full'>
              <SelectValue placeholder='Optional vision model' />
            </SelectTrigger>
            <SelectContent>
              {(selectedVisionProvider?.models ?? []).map(model => (
                <SelectItem
                  key={model.id}
                  value={model.id}
                >
                  {model.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className='rounded-md border border-border/70 bg-surface-band/35 px-3 py-2 text-xs text-foreground-muted'>
        <span className='font-medium text-foreground'>Provider health: </span>
        {isCheckingHealth
          ? 'Checking selected provider/model...'
          : health
            ? `${healthLabel(health)} - ${health.message}`
            : 'No provider selected.'}
      </div>
      <div className='grid gap-2'>
        <Label>Allowed tools</Label>
        <div className='max-h-56 overflow-y-auto rounded-md border border-border/70 bg-surface-band/35 p-3'>
          <div className='grid grid-cols-[repeat(auto-fit,minmax(min(15rem,100%),1fr))] gap-2'>
            {selectableCommands.map(command => {
              const checked = allowedTools.length === 0 || allowedTools.includes(command.uses)
              return (
                <label
                  key={command.uses}
                  className='flex min-w-0 items-start gap-2 rounded-sm px-2 py-1 text-sm hover:bg-white/7'
                >
                  <Checkbox
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
        <label className='flex items-center justify-between gap-3 rounded-md border border-border/70 bg-surface-band/35 px-3 py-2 min-[42rem]:col-span-full'>
          <span>
            <span className='block text-sm font-medium'>Require final answer</span>
            <span className='block text-xs text-foreground-muted'>
              Fail when the AI stops without a visible summary.
            </span>
          </span>
          <Checkbox
            checked={booleanValue(input, 'requireFinalAnswer', true)}
            onCheckedChange={value => patchInput({ requireFinalAnswer: value === true })}
          />
        </label>
      </div>
    </div>
  )
}
