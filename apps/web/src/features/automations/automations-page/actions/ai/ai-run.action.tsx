'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { catalogByRole, selectCatalogModel, selectCatalogProvider } from '@/shared/automation/automation-ai-catalog'
import { NumberField, TextareaField } from '../shared/action-fields'
import type { AutomationActionDefinition } from '../automation-action-definition'
import type { AutomationAiModelCatalogProvider, AutomationAiProviderHealth } from '@/server/orchestrator/settings/types'

const stringValue = (input: Record<string, unknown>, key: string) => (typeof input[key] === 'string' ? input[key] : '')

const numberValue = (input: Record<string, unknown>, key: string, fallback: number) =>
  typeof input[key] === 'number' && Number.isFinite(input[key]) ? input[key] : fallback

const booleanValue = (input: Record<string, unknown>, key: string, fallback: boolean) =>
  typeof input[key] === 'boolean' ? input[key] : fallback

const stringArrayValue = (input: Record<string, unknown>, key: string) =>
  Array.isArray(input[key]) ? input[key].filter((item): item is string => typeof item === 'string') : []

const healthLabel = (health: AutomationAiProviderHealth) =>
  health.status === 'ok' ? 'Online' : health.status === 'disabled' ? 'Disabled' : 'Error'

export const aiRunAction: AutomationActionDefinition = {
  uses: 'ai.run',
  category: 'AI',
  iconKey: 'sparkles',
  label: 'AI run',
  description: 'Runs an AI harness that can call permitted automation tools to satisfy a prompt.',
  defaultInput: () => ({
    prompt: 'Inspect the screen and complete the requested task.',
    maxToolCalls: 20,
    timeoutMs: 120000,
    requireFinalAnswer: true
  }),
  normalizeInput: input => ({
    prompt: stringValue(input, 'prompt') || 'Inspect the screen and complete the requested task.',
    ...(stringValue(input, 'providerId') ? { providerId: stringValue(input, 'providerId') } : {}),
    ...(stringValue(input, 'modelId') ? { modelId: stringValue(input, 'modelId') } : {}),
    ...(stringValue(input, 'visionProviderId') ? { visionProviderId: stringValue(input, 'visionProviderId') } : {}),
    ...(stringValue(input, 'visionModelId') ? { visionModelId: stringValue(input, 'visionModelId') } : {}),
    ...(stringArrayValue(input, 'allowedTools').length > 0
      ? { allowedTools: stringArrayValue(input, 'allowedTools') }
      : {}),
    maxToolCalls: Math.min(Math.max(numberValue(input, 'maxToolCalls', 20), 1), 100),
    timeoutMs: Math.min(Math.max(numberValue(input, 'timeoutMs', 120000), 1000), 360_0000),
    requireFinalAnswer: booleanValue(input, 'requireFinalAnswer', true)
  }),
  summary: input => {
    const prompt = stringValue(input, 'prompt').trim()
    const provider = stringValue(input, 'providerId')
    const model = stringValue(input, 'modelId')
    const visionProvider = stringValue(input, 'visionProviderId')
    const visionModel = stringValue(input, 'visionModelId')
    const maxToolCalls = numberValue(input, 'maxToolCalls', 20)
    const timeoutSeconds = Math.round(numberValue(input, 'timeoutMs', 120000) / 1000)
    const preview = prompt.length > 72 ? `${prompt.slice(0, 72)}...` : prompt || 'No prompt'
    const vision =
      visionProvider || visionModel
        ? ` · vision ${visionProvider || 'default'}${visionModel ? `/${visionModel}` : ''}`
        : ''
    return `${preview} · planner ${provider || 'default'}${model ? `/${model}` : ''}${vision} · ${timeoutSeconds}s · ${maxToolCalls} calls`
  },
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
  const selectableCommands = useMemo(
    () =>
      commands.filter(command => command.uses !== 'ai.run').sort((left, right) => left.uses.localeCompare(right.uses)),
    [commands]
  )

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
        const plannerProviders = catalogByRole(nextCatalog, 'planner')
        const visionProviders = catalogByRole(nextCatalog, 'vision')
        const provider = selectCatalogProvider(plannerProviders, providerId)
        const model = selectCatalogModel(provider, modelId)
        const visionProvider = selectCatalogProvider(visionProviders, visionProviderId)
        const visionModel = selectCatalogModel(visionProvider, visionModelId)
        const patch: Record<string, unknown> = {}
        if (provider && provider.id !== providerId) patch.providerId = provider.id
        if (model && model.id !== modelId) patch.modelId = model.id
        if (visionProvider && !visionProviderId) patch.visionProviderId = visionProvider.id
        if (visionModel && !visionModelId) patch.visionModelId = visionModel.id
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
    const next = new Set(allowedTools.length === 0 ? selectableCommands.map(command => command.uses) : allowedTools)
    if (enabled) next.add(uses)
    else next.delete(uses)
    const selected = Array.from(next)
    patchInput({ allowedTools: selected.length === selectableCommands.length ? [] : selected })
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
      <div className='rounded-md border border-border/70 bg-background/25 px-3 py-2 text-xs text-secondary-foreground'>
        <span className='font-medium text-foreground'>Provider health: </span>
        {isCheckingHealth
          ? 'Checking selected provider/model...'
          : health
            ? `${healthLabel(health)} - ${health.message}`
            : 'No provider selected.'}
      </div>
      <div className='grid gap-2'>
        <Label>Allowed tools</Label>
        <div className='max-h-56 overflow-y-auto rounded-md border border-border/70 bg-background/25 p-3'>
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
                    <span className='block truncate text-xs text-secondary-foreground'>{command.uses}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </div>
        <p className='text-xs text-secondary-foreground'>All tools are allowed until one tool is unchecked.</p>
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
        <label className='flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/25 px-3 py-2 min-[42rem]:col-span-full'>
          <span>
            <span className='block text-sm font-medium'>Require final answer</span>
            <span className='block text-xs text-secondary-foreground'>
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
