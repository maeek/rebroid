'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  IconCircleCheck,
  IconCircleDashed,
  IconCircleX,
  IconPlayerPlay,
  IconPlayerStop,
  IconSend,
  IconSettings,
  IconSparkles
} from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  cancelAutomationRunAction,
  createAutomationRunEventStreamUrlAction,
  listAdHocAiAutomationRunsAction,
  listAutomationRunEventsAction,
  runAdHocAiAutomationAction
} from '@/server/orchestrator/automations/automation-run-actions'
import {
  checkAutomationAiProviderHealthAction,
  listAutomationAiModelCatalogAction
} from '@/server/orchestrator/settings/actions'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { AutomationRun, AutomationRunEvent } from '@/server/orchestrator/automations/types'
import type { AutomationAiModelCatalogProvider, AutomationAiProviderHealth } from '@/server/orchestrator/settings/types'

const activeRunStatuses = new Set<AutomationRun['status']>(['queued', 'running'])
const terminalRunStatuses = new Set<AutomationRun['status']>(['success', 'failed', 'canceled'])

type ChatTurnStatus = 'queued' | 'starting' | 'running' | 'success' | 'failed' | 'canceled'
type ChatConversationMessage = { role: 'user' | 'assistant'; content: string }

interface ChatTurn {
  id: string
  prompt: string
  status: ChatTurnStatus
  run: AutomationRun | null
  events: AutomationRunEvent[]
  error?: string | null
}

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

const updateRunStatusFromEvent = (event: AutomationRunEvent): AutomationRun['status'] | null => {
  if (event.type === 'run.started') return 'running'
  if (event.type === 'run.completed') return 'success'
  if (event.type === 'run.failed') return 'failed'
  if (event.type === 'run.canceled') return 'canceled'
  return null
}

const compactJson = (value: unknown) => {
  if (!value || typeof value !== 'object') return ''
  try {
    const text = JSON.stringify(value)
    return text.length > 220 ? `${text.slice(0, 220)}...` : text
  } catch {
    return ''
  }
}

const runStatusBadgeVariant = (status: ChatTurnStatus) =>
  status === 'failed' || status === 'canceled' ? 'destructive' : 'secondary'

const chatTurnTitle = (turn: ChatTurn) => {
  if (turn.status === 'queued') return 'Queued'
  if (turn.status === 'starting') return 'Starting'
  if (turn.status === 'running') return 'Running'
  if (turn.status === 'success') return 'Done'
  if (turn.status === 'canceled') return 'Canceled'
  return 'Failed'
}

const eventToolName = (event: AutomationRunEvent) =>
  typeof event.data.uses === 'string' ? event.data.uses : event.message

const runStatusToTurnStatus = (status: AutomationRun['status']): ChatTurnStatus => {
  if (status === 'queued' || status === 'running') return 'running'
  return status
}

const chatTurnFromRun = (run: AutomationRun, events: AutomationRunEvent[]): ChatTurn => {
  const userEvent = events.find(event => event.type === 'ai.user.message')
  const clientMessageId =
    userEvent && typeof userEvent.data.clientMessageId === 'string' ? userEvent.data.clientMessageId : run.id
  return {
    id: clientMessageId,
    prompt: userEvent?.message || 'Ad-hoc AI run',
    status: runStatusToTurnStatus(run.status),
    run,
    events
  }
}

const lastAssistantText = (turn: ChatTurn) =>
  [...turn.events]
    .reverse()
    .find(event => event.type === 'ai.message.completed')
    ?.message?.trim() ?? ''

const conversationBeforeTurn = (turnId: string, turns: ChatTurn[]): ChatConversationMessage[] => {
  const index = turns.findIndex(turn => turn.id === turnId)
  const priorTurns = index === -1 ? turns : turns.slice(0, index)
  return priorTurns
    .flatMap(turn => {
      const assistant = lastAssistantText(turn)
      return [
        { role: 'user' as const, content: turn.prompt },
        ...(assistant ? [{ role: 'assistant' as const, content: assistant }] : [])
      ]
    })
    .slice(-20)
}

const isValidAgentModel = (
  provider: AutomationAiModelCatalogProvider | undefined,
  model: AutomationAiModelCatalogProvider['models'][number] | undefined,
  health: AutomationAiProviderHealth | null
) => {
  if (!provider || !model) return false
  if (!model.supportsVision || !model.supportsTools) return false
  if (health && health.status !== 'ok') return false
  return true
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
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null)
  const [isCanceling, setIsCanceling] = useState(false)
  const [health, setHealth] = useState<AutomationAiProviderHealth | null>(null)
  const [isCheckingHealth, setIsCheckingHealth] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const transcriptRef = useRef<HTMLDivElement | null>(null)
  const lastSequenceRef = useRef(0)

  const selectedProvider = catalog.find(provider => provider.id === providerId) ?? catalog[0]
  const selectedModel =
    selectedProvider?.models.find(model => model.id === modelId) ??
    selectedProvider?.models.find(model => model.default) ??
    selectedProvider?.models[0]
  const activeTurn = turns.find(turn => turn.id === activeTurnId) ?? null
  const queuedTurn = turns.find(turn => turn.status === 'queued')
  const modelIsValid = isValidAgentModel(selectedProvider, selectedModel, health)

  const selectionMessage = useMemo(() => {
    if (!selectedProvider || !selectedModel) return 'Configure an enabled AI provider and model before sending.'
    if (!selectedModel.supportsVision) return 'Vision-capable model required for screen automation.'
    if (!selectedModel.supportsTools) return 'Tool-capable model required for Android automation.'
    if (health?.status === 'error') return health.message || 'Selected provider/model is not healthy.'
    if (health?.status === 'disabled') return 'Selected provider/model is disabled.'
    return null
  }, [health, selectedModel, selectedProvider])

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
    let cancelled = false

    const loadHistory = async () => {
      const runs = await listAdHocAiAutomationRunsAction(app.id, 20)
      const loadedTurns = await Promise.all(
        runs.map(async run => chatTurnFromRun(run, await listAutomationRunEventsAction(run.id, 0)))
      )
      if (cancelled) return
      const orderedTurns = loadedTurns.sort(
        (left, right) => new Date(left.run?.createdAt ?? '').getTime() - new Date(right.run?.createdAt ?? '').getTime()
      )
      setTurns(current => {
        const byRunId = new Map(current.filter(turn => turn.run).map(turn => [turn.run?.id, turn]))
        const currentWithoutRuns = current.filter(turn => !turn.run)
        for (const turn of orderedTurns) {
          if (!turn.run) continue
          byRunId.set(turn.run.id, turn)
        }
        return [...currentWithoutRuns, ...byRunId.values()]
      })
      const active = [...orderedTurns].reverse().find(turn => turn.run && activeRunStatuses.has(turn.run.status))
      if (active) setActiveTurnId(active.id)
    }

    void loadHistory().catch(historyError => {
      if (cancelled) return
      setError(historyError instanceof Error ? historyError.message : 'AI chat history could not be loaded.')
    })

    return () => {
      cancelled = true
    }
  }, [app.id])

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

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns])

  const appendRunEvents = useCallback((runId: string, nextEvents: AutomationRunEvent[]) => {
    if (nextEvents.length === 0) return
    setTurns(current =>
      current.map(turn => {
        if (turn.run?.id !== runId) return turn
        const byId = new Map(turn.events.map(event => [event.id, event]))
        for (const event of nextEvents) {
          byId.set(event.id, event)
          lastSequenceRef.current = Math.max(lastSequenceRef.current, event.sequence)
        }
        const statusEvent = nextEvents.map(updateRunStatusFromEvent).find(Boolean)
        const nextStatus =
          statusEvent === 'success'
            ? 'success'
            : statusEvent === 'failed'
              ? 'failed'
              : statusEvent === 'canceled'
                ? 'canceled'
                : statusEvent === 'running'
                  ? 'running'
                  : turn.status
        return {
          ...turn,
          status: nextStatus,
          run: statusEvent ? { ...turn.run, status: statusEvent } : turn.run,
          events: [...byId.values()].sort((left, right) => left.sequence - right.sequence)
        }
      })
    )
    const terminalStatus = nextEvents
      .map(updateRunStatusFromEvent)
      .find(status => status && terminalRunStatuses.has(status))
    if (terminalStatus) {
      setActiveTurnId(null)
    }
  }, [])

  const activeRun = activeTurn?.run ?? null
  useEffect(() => {
    if (!activeRun || !activeRunStatuses.has(activeRun.status)) return
    let closed = false
    let socket: WebSocket | null = null
    lastSequenceRef.current = 0

    const connect = async () => {
      const initialEvents = await listAutomationRunEventsAction(activeRun.id, lastSequenceRef.current)
      if (closed) return
      appendRunEvents(activeRun.id, initialEvents)
      const url = await createAutomationRunEventStreamUrlAction(activeRun.id, lastSequenceRef.current)
      if (closed) return
      socket = new WebSocket(url)
      socket.onmessage = event => {
        const payload = JSON.parse(String(event.data)) as { type: string; event?: AutomationRunEvent }
        if (payload.type === 'event' && payload.event) appendRunEvents(activeRun.id, [payload.event])
      }
      socket.onclose = () => {
        if (!closed) window.setTimeout(() => void connect(), 1500)
      }
    }

    void connect()
    return () => {
      closed = true
      socket?.close()
    }
  }, [activeRun, appendRunEvents])

  const startTurn = useCallback(
    async (turn: ChatTurn, conversation: ChatConversationMessage[]) => {
      if (!selectedProvider || !selectedModel) return
      setActiveTurnId(turn.id)
      setError(null)
      setTurns(current =>
        current.map(item => (item.id === turn.id ? { ...item, status: 'starting', error: null } : item))
      )
      try {
        const nextRun = await runAdHocAiAutomationAction({
          targetApplicationId: app.id,
          profileMode: app.profileMode,
          profileName: app.profileName,
          prompt: turn.prompt,
          conversation,
          providerId: selectedProvider.id,
          modelId: selectedModel.id,
          clientMessageId: turn.id,
          maxToolCalls: 20,
          timeoutMs: 120000,
          startPolicy: 'require-running'
        })
        setTurns(current =>
          current.map(item =>
            item.id === turn.id
              ? {
                  ...item,
                  status: activeRunStatuses.has(nextRun.status) ? 'running' : (nextRun.status as ChatTurnStatus),
                  run: nextRun
                }
              : item
          )
        )
        onRunStarted?.(nextRun)
      } catch (submitError) {
        const message = submitError instanceof Error ? submitError.message : 'AI automation could not start.'
        setTurns(current =>
          current.map(item => (item.id === turn.id ? { ...item, status: 'failed', error: message } : item))
        )
        setActiveTurnId(null)
        setError(message)
      }
    },
    [app, onRunStarted, selectedModel, selectedProvider]
  )

  const submit = async () => {
    const text = prompt.trim()
    if (!text || !modelIsValid) return
    const nextTurn: ChatTurn = {
      id: crypto.randomUUID(),
      prompt: text,
      status: activeTurn ? 'queued' : 'starting',
      run: null,
      events: []
    }
    setTurns(current => [...current, nextTurn])
    setPrompt('')
    if (!activeTurn) {
      await startTurn(nextTurn, conversationBeforeTurn(nextTurn.id, turns))
    }
  }

  const runQueuedTurn = async () => {
    if (!queuedTurn || activeTurn) return
    await startTurn(queuedTurn, conversationBeforeTurn(queuedTurn.id, turns))
  }

  const canCancelRun = activeTurn?.run && activeRunStatuses.has(activeTurn.run.status)

  const cancelRun = async () => {
    if (!activeTurn?.run || !canCancelRun) return
    setIsCanceling(true)
    setError(null)
    try {
      const canceled = await cancelAutomationRunAction(activeTurn.run.id)
      setTurns(current =>
        current.map(turn =>
          turn.id === activeTurn.id
            ? {
                ...turn,
                status: 'canceled',
                run: canceled
              }
            : turn
        )
      )
      setActiveTurnId(null)
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'AI automation could not be canceled.')
    } finally {
      setIsCanceling(false)
    }
  }

  const canSubmit = Boolean(prompt.trim()) && modelIsValid && !isCheckingHealth

  return (
    <section className={cn('grid gap-4 p-4', className)}>
      {hideHeader ? null : (
        <div className='flex items-center gap-2'>
          <IconSparkles className='size-4 text-primary' />
          <div>
            <h3 className='text-sm font-semibold'>AI agent</h3>
            <p className='text-xs text-secondary-foreground'>Run a session-only Android automation chat.</p>
          </div>
        </div>
      )}

      <div
        ref={transcriptRef}
        className='grid max-h-96 gap-3 overflow-auto pr-1'
      >
        {turns.length === 0 ? (
          <div className='rounded-md border border-dashed border-border/70 p-3 text-sm text-secondary-foreground'>
            Send a message to start an ephemeral AI run. Screenshots, tool calls, and responses appear here.
          </div>
        ) : (
          turns.map(turn => (
            <ChatTurnView
              key={turn.id}
              turn={turn}
            />
          ))
        )}
      </div>

      <div className='grid gap-2'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <Label>Message</Label>
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
                      Choose a vision and tool-capable model for screen automation.
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
                          const nextModel = nextProvider?.models.find(model => model.default) ?? nextProvider?.models[0]
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
                              {!model.supportsVision || !model.supportsTools ? ' (incompatible)' : ''}
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
          rows={4}
          placeholder='Ask the AI to inspect the current screen and operate this app.'
          onChange={event => setPrompt(event.target.value)}
          onKeyDown={event => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault()
              void submit()
            }
          }}
        />
        {selectionMessage ? <div className='text-xs text-destructive'>{selectionMessage}</div> : null}
        {error ? <div className='text-xs text-destructive'>{error}</div> : null}
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <span className='text-xs text-secondary-foreground'>
            Each message starts an ephemeral run with a fresh screenshot. Messages sent during a run wait in the queue.
          </span>
          <div className='flex items-center gap-2'>
            {queuedTurn && !activeTurn ? (
              <Button
                type='button'
                variant='secondary'
                onClick={() => void runQueuedTurn()}
              >
                <IconPlayerPlay className='size-4' />
                Run next
              </Button>
            ) : null}
            {canCancelRun ? (
              <Button
                type='button'
                variant='secondary'
                disabled={isCanceling}
                onClick={() => void cancelRun()}
              >
                <IconPlayerStop className='size-4' />
                {isCanceling ? 'Canceling' : 'Cancel'}
              </Button>
            ) : null}
            <Button
              type='button'
              disabled={!canSubmit}
              onClick={() => void submit()}
            >
              <IconSend className='size-4' />
              {activeTurn ? 'Queue' : 'Send'}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

const ChatTurnView = ({ turn }: { turn: ChatTurn }) => {
  const visibleEvents = turn.events.filter(event => event.type !== 'heartbeat' && event.message.trim().length > 0)
  return (
    <article className='grid gap-2'>
      <div className='ml-auto max-w-[85%] rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground'>
        {turn.prompt}
      </div>
      <div className='grid gap-2 rounded-md border border-border/70 bg-background/35 p-3'>
        <div className='flex items-center justify-between gap-3'>
          <div className='flex min-w-0 items-center gap-2'>
            <IconSparkles className='size-4 shrink-0 text-primary' />
            <span className='truncate text-sm font-medium'>AI agent</span>
          </div>
          <Badge
            variant={runStatusBadgeVariant(turn.status)}
            className='capitalize'
          >
            {chatTurnTitle(turn)}
          </Badge>
        </div>
        {turn.error ? <div className='text-xs text-destructive'>{turn.error}</div> : null}
        {turn.status === 'queued' ? (
          <div className='text-sm text-secondary-foreground'>
            Waiting for the active run to finish. Use Run next to start it.
          </div>
        ) : null}
        {visibleEvents.length === 0 && turn.status !== 'queued' ? (
          <div className='text-sm text-secondary-foreground'>Waiting for the agent to start...</div>
        ) : null}
        {visibleEvents.map(event => (
          <ChatEventView
            key={event.id}
            event={event}
          />
        ))}
      </div>
    </article>
  )
}

const ChatEventView = ({ event }: { event: AutomationRunEvent }) => {
  if (event.type === 'ai.user.message') return null
  if (event.type === 'ai.screenshot.observed') {
    const dataUrl = typeof event.data.dataUrl === 'string' ? event.data.dataUrl : ''
    return (
      <div className='grid gap-2'>
        <div className='text-xs text-secondary-foreground'>{event.message}</div>
        {dataUrl ? (
          <img
            src={dataUrl}
            alt='AI screen observation'
            className='max-h-52 w-fit rounded-md border border-border/70 object-contain'
          />
        ) : null}
      </div>
    )
  }
  if (event.type === 'ai.message.completed') {
    return <div className='whitespace-pre-wrap text-sm text-foreground'>{event.message}</div>
  }
  if (event.type === 'ai.tool.arguments') {
    return (
      <div className='font-mono text-xs text-secondary-foreground'>
        args: {eventToolName(event)} {compactJson(event.data.arguments)}
      </div>
    )
  }
  if (event.type === 'ai.tool.started') {
    return <div className='font-mono text-xs text-secondary-foreground'>tool: {eventToolName(event)}</div>
  }
  if (event.type === 'ai.tool.completed') {
    return <div className='font-mono text-xs text-secondary-foreground'>done: {eventToolName(event)}</div>
  }
  if (event.type === 'ai.tool.failed' || event.type === 'ai.guardrail.triggered' || event.type === 'run.failed') {
    return <div className='text-xs text-destructive'>{event.message}</div>
  }
  if (event.type === 'run.canceled') {
    return <div className='text-xs text-destructive'>Run canceled.</div>
  }
  if (event.type === 'run.started' || event.type === 'run.queued' || event.type === 'ai.model.started') {
    return <div className='font-mono text-xs text-secondary-foreground'>{event.message}</div>
  }
  return null
}
