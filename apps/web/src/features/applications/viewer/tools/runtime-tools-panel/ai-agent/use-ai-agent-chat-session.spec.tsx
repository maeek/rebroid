import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getBff, sendBff } from '@/lib/http/bff'
import * as actions from '@/server/orchestrator/automations/automation-run-actions'
import { useAiAgentChatSession } from './use-ai-agent-chat-session'
import * as modelSettings from './use-ai-agent-model-settings'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { AutomationRun, AutomationRunEvent } from '@/shared/contracts/automation'

vi.mock('@/server/orchestrator/automations/automation-run-actions', () => ({
  cancelAutomationRunAction: vi.fn(),
  clearAdHocAiAutomationRunsAction: vi.fn(),
  listAdHocAiAutomationRunHistoryAction: vi.fn(),
  runAdHocAiAutomationAction: vi.fn()
}))
vi.mock('@/lib/http/bff', () => ({ getBff: vi.fn(), sendBff: vi.fn() }))

vi.mock('./use-ai-agent-model-settings', () => ({
  useAiAgentModelSettings: vi.fn()
}))

const app = {
  id: 'app_1',
  running: true,
  profileMode: 'temporary',
  profileName: null
} as AppDefinition

const run = {
  id: 'run_1',
  automationId: 'automation_1',
  automationTriggerId: null,
  ownerUserId: 'user_1',
  targetApplicationId: 'app_1',
  targetProfileMode: 'temporary',
  targetProfileName: null,
  trigger: 'manual',
  status: 'success',
  startedAt: null,
  completedAt: null,
  stepResults: [],
  error: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
} satisfies AutomationRun

const userEvent = {
  id: 'event_1',
  runId: 'run_1',
  ownerUserId: 'user_1',
  sequence: 1,
  type: 'ai.user.message',
  stepId: null,
  parentStepId: null,
  message: 'Find Downloads',
  data: { clientMessageId: 'turn_1' },
  createdAt: '2026-01-01T00:00:00.000Z'
} satisfies AutomationRunEvent
const eventPage = (events: AutomationRunEvent[]) => ({ events, nextAfter: null })
const eventPath = (after: number) => `/api/bff/automations/runs/${run.id}/events?after=${after}`

describe('useAiAgentChatSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(actions.listAdHocAiAutomationRunHistoryAction).mockResolvedValue([{ run, events: [userEvent] }])
    vi.mocked(getBff).mockResolvedValue(eventPage([]))
    vi.mocked(sendBff).mockResolvedValue({ streamUrl: 'ws://localhost/events' })
    vi.mocked(modelSettings.useAiAgentModelSettings).mockReturnValue({
      adHocTimeoutMinutes: 5,
      adHocTimeoutMs: 300_000,
      catalog: [],
      health: null,
      isCheckingHealth: false,
      modelIsValid: true,
      primaryCatalog: [],
      recheckHealth: vi.fn<() => Promise<void>>(() => Promise.resolve()),
      selectedModel: {
        id: 'model_1',
        label: 'Model',
        roles: ['planner'],
        enabled: true,
        defaultFor: ['planner'],
        settings: {}
      },
      selectedProvider: { id: 'provider_1', label: 'Provider', kind: 'ollama', models: [] },
      selectedVisionModel: undefined,
      selectedVisionProvider: undefined,
      selectionMessage: null,
      selectPrimaryModel: vi.fn(),
      setVisionModelId: vi.fn(),
      setVisionProviderId: vi.fn(),
      setTimeoutMinutesInput: vi.fn(),
      timeoutMinutesInput: '5',
      visionCatalog: []
    })
  })

  it('holds the first Send locally and dispatches it with restored context after a history retry', async () => {
    type History = Awaited<ReturnType<typeof actions.listAdHocAiAutomationRunHistoryAction>>
    const initial = Promise.withResolvers<History>()
    const retry = Promise.withResolvers<History>()
    vi.mocked(actions.listAdHocAiAutomationRunHistoryAction)
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(retry.promise)
    vi.mocked(actions.runAdHocAiAutomationAction).mockResolvedValue({ ...run, id: 'new-run' })
    const { result } = renderHook(() => useAiAgentChatSession({ app }))

    act(() => result.current.setPrompt('Open settings'))
    await act(() => result.current.submit())
    expect(result.current.turns.map(turn => [turn.prompt, turn.status])).toEqual([
      ['Open settings', 'waiting-for-history']
    ])
    expect(result.current.prompt).toBe('')
    expect(actions.runAdHocAiAutomationAction).not.toHaveBeenCalled()

    await act(() => {
      initial.reject(new Error('Unavailable'))
      return initial.promise.catch(() => undefined)
    })
    expect(result.current.historyLoadFailed).toBe(true)
    expect(result.current.turns[0]?.prompt).toBe('Open settings')

    act(() => result.current.retryHistory())
    await act(() => {
      retry.resolve([{ run, events: [userEvent] }])
      return retry.promise
    })
    await waitFor(() => expect(actions.runAdHocAiAutomationAction).toHaveBeenCalledTimes(1))
    const sent = vi.mocked(actions.runAdHocAiAutomationAction).mock.lastCall?.[0]
    expect(sent?.prompt).toBe('Open settings')
    expect(sent?.conversation).toEqual([{ role: 'user', content: 'Find Downloads' }])
    expect(result.current.turns.map(turn => turn.prompt)).toEqual(['Find Downloads', 'Open settings'])
  })

  it('keeps local submission order and requires Run next when history restores an active task', async () => {
    const history = Promise.withResolvers<Awaited<ReturnType<typeof actions.listAdHocAiAutomationRunHistoryAction>>>()
    vi.mocked(actions.listAdHocAiAutomationRunHistoryAction).mockReturnValueOnce(history.promise)
    const { result } = renderHook(() => useAiAgentChatSession({ app }))

    await act(async () => {
      await result.current.submitPrompt('First')
      await result.current.submitPrompt('Second')
    })
    await act(() => {
      history.resolve([{ run: { ...run, status: 'running' }, events: [userEvent] }])
      return history.promise
    })
    expect(result.current.turns.map(turn => [turn.prompt, turn.status])).toEqual([
      ['Find Downloads', 'running'],
      ['First', 'queued'],
      ['Second', 'queued']
    ])
    expect(result.current.canRunQueuedTurn).toBe(false)
    expect(actions.runAdHocAiAutomationAction).not.toHaveBeenCalled()
  })

  it('restores a failed prompt without reporting acceptance', async () => {
    vi.mocked(actions.runAdHocAiAutomationAction).mockRejectedValue(new Error('Unable to start'))
    const { result } = renderHook(() => useAiAgentChatSession({ app }))
    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false))
    act(() => result.current.setPrompt('Open settings'))
    await act(() => result.current.submit())
    expect(result.current.prompt).toBe('Open settings')
    expect(result.current.submissionFeedback).toBeNull()
  })

  it('does not replace a new draft when the previous submission fails', async () => {
    const request = Promise.withResolvers<AutomationRun>()
    vi.mocked(actions.runAdHocAiAutomationAction).mockReturnValue(request.promise)
    const { result } = renderHook(() => useAiAgentChatSession({ app }))
    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false))
    act(() => result.current.setPrompt('Open settings'))
    let submitting: Promise<void>
    act(() => {
      submitting = result.current.submit()
    })
    act(() => result.current.setPrompt('My next draft'))
    await act(async () => {
      request.reject(new Error('Unable to start'))
      await submitting
    })
    expect(result.current.prompt).toBe('My next draft')
    expect(result.current.submissionFeedback).toBeNull()
  })

  it('acknowledges an accepted message and clears its draft', async () => {
    vi.mocked(actions.runAdHocAiAutomationAction).mockResolvedValue(run)
    const { result } = renderHook(() => useAiAgentChatSession({ app }))
    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false))
    act(() => result.current.setPrompt('Open settings'))
    await act(() => result.current.submit())
    expect(result.current.prompt).toBe('')
    expect(result.current.submissionFeedback).toBe('Message sent')
  })

  it('clears visible conversation before backend deletion finishes', async () => {
    let resolveClear: (value: { cleared: number }) => void = () => undefined
    const clearPromise = new Promise<{ cleared: number }>(resolve => {
      resolveClear = resolve
    })
    vi.mocked(actions.clearAdHocAiAutomationRunsAction).mockReturnValue(clearPromise)

    const { result } = renderHook(() => useAiAgentChatSession({ app }))
    await waitFor(() => expect(result.current.turns).toHaveLength(1))

    let pendingClear: Promise<void>
    await act(async () => {
      pendingClear = result.current.clearConversation()
      await Promise.resolve()
    })

    expect(result.current.turns).toHaveLength(0)
    expect(result.current.activeTurn).toBeNull()
    expect(result.current.isClearing).toBe(true)

    await act(async () => {
      resolveClear({ cleared: 1 })
      await pendingClear
    })

    expect(result.current.isClearing).toBe(false)
  })

  it('clears a run admitted while a start request is pending', async () => {
    let admitRun: (admitted: typeof run) => void = () => undefined
    vi.mocked(actions.runAdHocAiAutomationAction).mockReturnValue(
      new Promise(resolve => {
        admitRun = resolve
      })
    )
    const onRunStarted = vi.fn()
    const { result } = renderHook(() => useAiAgentChatSession({ app, onRunStarted }))
    await waitFor(() => expect(result.current.turns).toHaveLength(1))

    let start: Promise<void>
    let clear: Promise<void>
    act(() => {
      start = result.current.submitPrompt('Open settings')
      clear = result.current.clearConversation()
    })
    expect(result.current.turns).toEqual([])
    expect(actions.clearAdHocAiAutomationRunsAction).not.toHaveBeenCalled()

    await act(async () => {
      admitRun(run)
      await Promise.all([start, clear])
    })
    expect(actions.clearAdHocAiAutomationRunsAction).toHaveBeenCalledWith(app.id)
    expect(result.current.turns).toEqual([])
    expect(onRunStarted).not.toHaveBeenCalled()
  })

  it('keeps transcript position when history arrives after the user scrolled up', async () => {
    let resolveHistory: (
      value: Awaited<ReturnType<typeof actions.listAdHocAiAutomationRunHistoryAction>>
    ) => void = () => undefined
    vi.mocked(actions.listAdHocAiAutomationRunHistoryAction).mockReturnValue(
      new Promise(resolve => {
        resolveHistory = resolve
      })
    )
    const transcript = createTranscriptElement({ scrollTop: 700 })

    const { result } = renderHook(() => useAiAgentChatSession({ app }))

    act(() => {
      ;(result.current.transcriptRef as { current: HTMLDivElement | null }).current = transcript.element
      result.current.onTranscriptScroll()
    })

    await act(async () => {
      resolveHistory([{ run, events: [userEvent] }])
      await Promise.resolve()
    })

    await waitFor(() => expect(result.current.turns).toHaveLength(1))
    expect(transcript.scrollTo).not.toHaveBeenCalled()
  })

  it('sticks to the transcript bottom when history arrives near the bottom', async () => {
    let resolveHistory: (
      value: Awaited<ReturnType<typeof actions.listAdHocAiAutomationRunHistoryAction>>
    ) => void = () => undefined
    vi.mocked(actions.listAdHocAiAutomationRunHistoryAction).mockReturnValue(
      new Promise(resolve => {
        resolveHistory = resolve
      })
    )
    const transcript = createTranscriptElement({ scrollTop: 850 })

    const { result } = renderHook(() => useAiAgentChatSession({ app }))

    act(() => {
      ;(result.current.transcriptRef as { current: HTMLDivElement | null }).current = transcript.element
      result.current.onTranscriptScroll()
    })

    await act(async () => {
      resolveHistory([{ run, events: [userEvent] }])
      await Promise.resolve()
    })

    await waitFor(() => expect(result.current.turns).toHaveLength(1))
    expect(transcript.scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'instant' })
  })

  it('starts an explicitly approved follow-up with one-run shell escalation', async () => {
    vi.mocked(actions.runAdHocAiAutomationAction).mockResolvedValue(run)
    const { result } = renderHook(() => useAiAgentChatSession({ app }))
    await waitFor(() => expect(result.current.turns).toHaveLength(1))

    await act(async () => {
      await result.current.submitPrompt('Continue with the approved diagnostic.', {
        rawShellPolicy: 'allowlisted'
      })
    })

    expect(actions.runAdHocAiAutomationAction).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Continue with the approved diagnostic.',
        rawShellPolicy: 'allowlisted'
      })
    )
  })

  it('keeps newer prompts behind prompts already queued', async () => {
    const startRun = vi.mocked(actions.runAdHocAiAutomationAction)
    startRun.mockClear()
    startRun.mockResolvedValueOnce({ ...run, id: 'next-run' }).mockResolvedValueOnce({ ...run, id: 'queued-run' })
    const { result } = renderHook(() => useAiAgentChatSession({ app }))
    await waitFor(() => expect(result.current.turns).toHaveLength(1))

    await act(async () => {
      const first = result.current.submitPrompt('Open settings')
      await result.current.submitPrompt('Find display settings')
      await first
    })
    expect(result.current.activeTurn).toBeNull()

    await act(async () => {
      await result.current.submitPrompt('Find brightness')
    })
    expect(startRun).toHaveBeenCalledTimes(1)
    expect(result.current.queuedTurn?.prompt).toBe('Find display settings')

    await act(async () => {
      await result.current.runQueuedTurn()
    })
    expect(startRun).toHaveBeenLastCalledWith(expect.objectContaining({ prompt: 'Find display settings' }))
    expect(result.current.queuedTurn?.prompt).toBe('Find brightness')
  })

  it('replays final transcript events when the cancel response arrives before the stream', async () => {
    const listEvents = vi.mocked(getBff)
    vi.mocked(actions.listAdHocAiAutomationRunHistoryAction).mockResolvedValue([
      { run: { ...run, status: 'running' }, events: [userEvent] }
    ])
    vi.mocked(actions.cancelAutomationRunAction).mockResolvedValue({ ...run, status: 'canceled' })
    const { result } = renderHook(() => useAiAgentChatSession({ app }))
    await waitFor(() => expect(listEvents).toHaveBeenCalledWith(eventPath(1), expect.any(AbortSignal)))

    const assistantEvent = {
      ...userEvent,
      id: 'event_2',
      sequence: 2,
      type: 'ai.message.completed',
      message: 'Opened settings before cancellation.'
    } satisfies AutomationRunEvent
    const canceledEvent = {
      ...userEvent,
      id: 'event_3',
      sequence: 3,
      type: 'run.canceled',
      message: 'Automation canceled.'
    } satisfies AutomationRunEvent
    listEvents.mockResolvedValueOnce(eventPage([assistantEvent])).mockResolvedValueOnce(eventPage([canceledEvent]))

    await act(async () => {
      await result.current.cancelRun()
    })

    expect(listEvents).toHaveBeenLastCalledWith(eventPath(2), undefined)
    expect(result.current.activeTurn).toBeNull()
    expect(result.current.turns[0]).toMatchObject({
      status: 'canceled',
      events: [userEvent, assistantEvent, canceledEvent]
    })
  })

  it('keeps stopped-device prompt drafts from starting a run', async () => {
    const { result } = renderHook(() => useAiAgentChatSession({ app: { ...app, running: false } }))
    await waitFor(() => expect(result.current.turns).toHaveLength(1))

    act(() => {
      result.current.setPrompt('Open settings')
    })

    expect(result.current.canSubmit).toBe(false)
    await act(async () => {
      await result.current.submitPrompt('Open settings')
    })
    expect(actions.runAdHocAiAutomationAction).not.toHaveBeenCalled()
  })
})

const createTranscriptElement = ({
  clientHeight = 100,
  scrollHeight = 1000,
  scrollTop
}: {
  clientHeight?: number
  scrollHeight?: number
  scrollTop: number
}) => {
  const element = document.createElement('div')
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: clientHeight })
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: scrollHeight })
  element.scrollTop = scrollTop
  const scrollTo = vi.fn((options?: ScrollToOptions) => {
    if (typeof options?.top === 'number') element.scrollTop = options.top
  })
  Object.defineProperty(element, 'scrollTo', { configurable: true, value: scrollTo })
  return { element, scrollTo }
}
