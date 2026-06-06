import { IconCircleCheck, IconCircleDashed, IconCircleX, IconRefresh, IconSettings } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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

export const AiAgentModelStatus = ({
  health,
  isCheckingHealth,
  selectedModel
}: {
  health: AutomationAiProviderHealth | null
  isCheckingHealth: boolean
  selectedModel: AutomationAiModelCatalogProvider['models'][number] | undefined
}) => (
  <div className='hidden min-w-0 items-center gap-2 rounded-md border border-border/70 bg-background/25 px-3 py-2 text-xs text-secondary-foreground sm:flex'>
    {healthIcon(health, isCheckingHealth)}
    <span className='min-w-0 truncate'>
      {selectedModel?.label ?? 'No model selected'}
      {health ? ` - ${healthLabel(health)}` : ''}
    </span>
  </div>
)

export const AiAgentSettingsPopover = ({
  adHocTimeoutMinutes,
  catalog,
  health,
  isCheckingHealth,
  onRecheckHealth,
  selectedModel,
  selectedProvider,
  selectedVisionModel,
  selectedVisionProvider,
  setModelId,
  setProviderId,
  setVisionModelId,
  setVisionProviderId,
  setTimeoutMinutesInput,
  timeoutMinutesInput,
  visionCatalog
}: {
  adHocTimeoutMinutes: number
  catalog: AutomationAiModelCatalogProvider[]
  health: AutomationAiProviderHealth | null
  isCheckingHealth: boolean
  onRecheckHealth: () => void
  selectedModel: AutomationAiModelCatalogProvider['models'][number] | undefined
  selectedProvider: AutomationAiModelCatalogProvider | undefined
  selectedVisionModel: AutomationAiModelCatalogProvider['models'][number] | undefined
  selectedVisionProvider: AutomationAiModelCatalogProvider | undefined
  setModelId: (modelId: string) => void
  setProviderId: (providerId: string) => void
  setVisionModelId: (modelId: string) => void
  setVisionProviderId: (providerId: string) => void
  setTimeoutMinutesInput: (value: string) => void
  timeoutMinutesInput: string
  visionCatalog: AutomationAiModelCatalogProvider[]
}) => (
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
            Choose a planner model for tool calls and an optional vision model for screen summaries.
          </div>
        </div>
        <div className='grid gap-3'>
          <div className='grid gap-2'>
            <Label>Planner provider</Label>
            <Select
              value={selectedProvider?.id ?? ''}
              disabled={catalog.length === 0}
              onValueChange={nextProviderId => {
                const nextProvider = catalog.find(provider => provider.id === nextProviderId)
                const nextModel = nextProvider?.models.find(model => model.default) ?? nextProvider?.models[0]
                setProviderId(nextProviderId)
                setModelId(nextModel?.id ?? '')
              }}
            >
              <SelectTrigger className='w-full'>
                <SelectValue placeholder='Planner provider' />
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
            <Label>Planner model</Label>
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
          <div className='grid gap-2'>
            <Label>Vision provider</Label>
            <Select
              value={selectedVisionProvider?.id ?? ''}
              disabled={visionCatalog.length === 0}
              onValueChange={nextProviderId => {
                const nextProvider = visionCatalog.find(provider => provider.id === nextProviderId)
                const nextModel = nextProvider?.models.find(model => model.default) ?? nextProvider?.models[0]
                setVisionProviderId(nextProviderId)
                setVisionModelId(nextModel?.id ?? '')
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
              disabled={!selectedVisionProvider}
              onValueChange={setVisionModelId}
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
          <div className='grid gap-2'>
            <Label>Timeout</Label>
            <Input
              type='number'
              min={1}
              max={15}
              step={1}
              value={timeoutMinutesInput}
              onBlur={() => setTimeoutMinutesInput(String(adHocTimeoutMinutes))}
              onChange={event => {
                const value = event.target.value
                if (/^\d{0,2}$/.test(value)) setTimeoutMinutesInput(value)
              }}
            />
            <div className='text-xs text-secondary-foreground'>
              Maximum run time in minutes before the agent is stopped.
            </div>
          </div>
        </div>
        <div className='rounded-md border border-border/70 bg-background/25 px-3 py-2 text-xs text-secondary-foreground'>
          <div className='flex items-center justify-between gap-3'>
            <div className='flex min-w-0 items-center gap-2 font-medium text-foreground'>
              {healthIcon(health, isCheckingHealth)}
              Planner health
            </div>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='size-8'
              disabled={!selectedModel || isCheckingHealth}
              aria-label='Re-check planner health'
              onClick={onRecheckHealth}
            >
              <IconRefresh className={isCheckingHealth ? 'size-4 animate-spin' : 'size-4'} />
            </Button>
          </div>
          <div className='mt-1'>
            {isCheckingHealth
              ? 'Checking selected planner provider/model...'
              : health
                ? `${healthLabel(health)} - ${health.message}`
                : 'No provider selected.'}
          </div>
        </div>
      </div>
    </PopoverContent>
  </Popover>
)
