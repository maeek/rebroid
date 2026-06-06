'use client'

import { useEffect, useState } from 'react'
import {
  IconCircleCheck,
  IconCircleDashed,
  IconCircleX,
  IconSend,
  IconSettings,
  IconSparkles
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AutomationRunLiveEvents } from '@/features/automations/automations-page/traces/automation-run-live-events'
import { cn } from '@/lib/utils'
import { runAdHocAiAutomationAction } from '@/server/orchestrator/automations/automation-run-actions'
import {
  checkAutomationAiProviderHealthAction,
  listAutomationAiModelCatalogAction
} from '@/server/orchestrator/settings/actions'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { AutomationRun } from '@/server/orchestrator/automations/types'
import type { AutomationAiModelCatalogProvider, AutomationAiProviderHealth } from '@/server/orchestrator/settings/types'

const healthLabel = (health: AutomationAiProviderHealth) =>
  health.status === 'ok' ? 'Online' : health.status === 'disabled' ? 'Disabled' : 'Error'

const healthIcon = (health: AutomationAiProviderHealth | null, isCheckingHealth: boolean) => {
  if (isCheckingHealth) {
    return <IconCircleDashed className='size-4 animate-spin text-secondary-foreground' />
  }

  if (!health) {
    return <IconCircleDashed className='size-4 text-secondary-foreground' />
  }

  if (health.status === 'ok') {
    return <IconCircleCheck className='size-4 text-emerald-400' />
  }

  return <IconCircleX className='size-4 text-destructive' />
}

export const AiAgentToolsSection = ({
  app,
  className,
  hideHeader,
  onRunStarted
}: {
  app: AppDefinition
  className?: string
  hideHeader?: boolean
  onRunStarted?: (run: AutomationRun) => void
}) => {
  const [prompt, setPrompt] = useState('')
  const [catalog, setCatalog] = useState<AutomationAiModelCatalogProvider[]>([])
  const [providerId, setProviderId] = useState('')
  const [modelId, setModelId] = useState('')
  const [run, setRun] = useState<AutomationRun | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [health, setHealth] = useState<AutomationAiProviderHealth | null>(null)
  const [isCheckingHealth, setIsCheckingHealth] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedProvider = catalog.find(provider => provider.id === providerId) ?? catalog[0]
  const selectedModel =
    selectedProvider?.models.find(model => model.id === modelId) ??
    selectedProvider?.models.find(model => model.default) ??
    selectedProvider?.models[0]

  useEffect(() => {
    let cancelled = false
    void listAutomationAiModelCatalogAction().then(nextCatalog => {
      if (cancelled) return
      setCatalog(nextCatalog)
      const provider = nextCatalog[0]
      const model = provider?.models.find(item => item.default) ?? provider?.models[0]
      setProviderId(provider?.id ?? '')
      setModelId(model?.id ?? '')
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedProvider || !selectedModel) {
      setHealth(null)
      return
    }
    let cancelled = false
    setIsCheckingHealth(true)
    void checkAutomationAiProviderHealthAction(selectedProvider.id, selectedModel.id)
      .then(result => {
        if (!cancelled) setHealth(result)
      })
      .catch(healthError => {
        if (cancelled) return
        setHealth({
          providerId: selectedProvider.id,
          modelId: selectedModel.id,
          status: 'error',
          message: healthError instanceof Error ? healthError.message : 'Health check failed.',
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

  const submit = async () => {
    const text = prompt.trim()
    if (!text) return

    setIsRunning(true)
    setError(null)
    try {
      const nextRun = await runAdHocAiAutomationAction({
        targetApplicationId: app.id,
        profileMode: app.profileMode,
        profileName: app.profileName,
        prompt: text,
        providerId: selectedProvider?.id,
        modelId: selectedModel?.id,
        maxToolCalls: 20,
        timeoutMs: 120000,
        startPolicy: 'require-running'
      })
      setRun(nextRun)
      onRunStarted?.(nextRun)
      setPrompt('')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'AI automation could not start.')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <section className={cn('grid gap-4 rounded-md border border-border/70 bg-background/35 p-4', className)}>
      {hideHeader ? null : (
        <div className='flex items-center gap-2'>
          <IconSparkles className='size-4 text-primary' />
          <div>
            <h3 className='text-sm font-semibold'>AI agent</h3>
            <p className='text-xs text-secondary-foreground'>Run an ad-hoc AI automation against the current viewer.</p>
          </div>
        </div>
      )}
      <div className='grid gap-3'>
        <div className='grid gap-2'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <Label>Prompt</Label>
            <div className='flex min-w-0 items-center gap-2'>
              <div className='hidden min-w-0 items-center gap-2 rounded-md border border-border/70 bg-background/25 px-3 py-2 text-xs text-secondary-foreground sm:flex'>
                {healthIcon(health, isCheckingHealth)}
                <span className='min-w-0 truncate'>
                  {selectedModel?.label ?? 'No model selected'}
                  {health ? ` - ${healthLabel(health)}` : ''}
                </span>
              </div>
              <Popover>
                <Tooltip>
                  <PopoverTrigger asChild>
                    <TooltipTrigger asChild>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        aria-label='AI agent settings'
                      >
                        <IconSettings className='size-4' />
                        Settings
                      </Button>
                    </TooltipTrigger>
                  </PopoverTrigger>
                  <TooltipContent>AI agent settings</TooltipContent>
                </Tooltip>
                <PopoverContent
                  align='end'
                  className='w-[min(calc(100vw-2rem),24rem)]'
                >
                  <div className='grid gap-4'>
                    <div className='grid gap-1'>
                      <div className='text-sm font-medium'>AI settings</div>
                      <div className='text-xs text-secondary-foreground'>
                        Choose the provider and model used for this run.
                      </div>
                    </div>
                    <div className='grid gap-3'>
                      <div className='grid gap-2'>
                        <Label>Provider</Label>
                        <Select
                          value={selectedProvider?.id ?? ''}
                          disabled={catalog.length === 0}
                          onValueChange={nextProviderId => {
                            const nextProvider = catalog.find(provider => provider.id === nextProviderId)
                            const nextModel =
                              nextProvider?.models.find(model => model.default) ?? nextProvider?.models[0]
                            setProviderId(nextProviderId)
                            setModelId(nextModel?.id ?? '')
                          }}
                        >
                          <SelectTrigger className='w-full'>
                            <SelectValue placeholder='Provider' />
                          </SelectTrigger>
                          <SelectContent>
                            {catalog.map(provider => (
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
                        <Label>Model</Label>
                        <Select
                          value={selectedModel?.id ?? ''}
                          disabled={!selectedProvider}
                          onValueChange={setModelId}
                        >
                          <SelectTrigger className='w-full'>
                            <SelectValue placeholder='Model' />
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
                    </div>
                    <div className='rounded-md border border-border/70 bg-background/25 px-3 py-2 text-xs text-secondary-foreground'>
                      <div className='flex items-center gap-2 font-medium text-foreground'>
                        {healthIcon(health, isCheckingHealth)}
                        Provider health
                      </div>
                      <div className='mt-1'>
                        {isCheckingHealth
                          ? 'Checking selected provider/model...'
                          : health
                            ? `${healthLabel(health)} - ${health.message}`
                            : 'No provider selected.'}
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <Textarea
            value={prompt}
            rows={5}
            placeholder='Ask the AI to inspect the screen and operate this app.'
            onChange={event => setPrompt(event.target.value)}
          />
        </div>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <span className='text-xs text-secondary-foreground'>
            Progress and tool calls appear below as soon as the run starts.
          </span>
          <Button
            type='button'
            disabled={isRunning || !prompt.trim() || !selectedProvider || !selectedModel}
            onClick={() => void submit()}
          >
            <IconSend className='size-4' />
            Run
          </Button>
        </div>
        {error ? <div className='text-xs text-destructive'>{error}</div> : null}
      </div>
      {run ? (
        <AutomationRunLiveEvents
          run={run}
          compact
        />
      ) : (
        <div className='rounded-md border border-dashed border-border/70 p-3 text-sm text-secondary-foreground'>
          No AI run is active in this panel.
        </div>
      )}
    </section>
  )
}
