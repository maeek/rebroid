import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useAiAgentChatSession } from './use-ai-agent-chat-session'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { AutomationRun, AutomationRunEvent } from '@/server/orchestrator/automations/types'

jest.mock('@/server/orchestrator/automations/automation-run-actions', () => ({
  cancelAutomationRunAction: jest.fn(),
  clearAdHocAiAutomationRunsAction: jest.fn(),
  createAutomationRunEventStreamUrlAction: jest.fn(),
  listAdHocAiAutomationRunHistoryAction: jest.fn(),
  listAutomationRunEventsAction: jest.fn(),
  runAdHocAiAutomationAction: jest.fn()
}))

jest.mock('./use-ai-agent-model-settings', () => ({
  useAiAgentModelSettings: jest.fn()
}))

const actions = jest.requireMock<typeof import('@/server/orchestrator/automations/automation-run-actions')>(
  '@/server/orchestrator/automations/automation-run-actions'
)

const modelSettings = jest.requireMock<typeof import('./use-ai-agent-model-settings')>('./use-ai-agent-model-settings')

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

describe('useAiAgentChatSession', () => {
  beforeEach(() => {
    jest.mocked(actions.listAdHocAiAutomationRunHistoryAction).mockResolvedValue([{ run, events: [userEvent] }])
    jest.mocked(actions.listAutomationRunEventsAction).mockResolvedValue([])
    jest.mocked(actions.createAutomationRunEventStreamUrlAction).mockResolvedValue('ws://localhost/events')
    jest.mocked(modelSettings.useAiAgentModelSettings).mockReturnValue({
      adHocTimeoutMinutes: 5,
      adHocTimeoutMs: 300_000,
      catalog: [],
      health: null,
      isCheckingHealth: false,
      modelIsValid: true,
      plannerCatalog: [],
      recheckHealth: jest.fn<() => Promise<void>>(() => Promise.resolve()),
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
      setModelId: jest.fn(),
      setProviderId: jest.fn(),
      setVisionModelId: jest.fn(),
      setVisionProviderId: jest.fn(),
      setTimeoutMinutesInput: jest.fn(),
      timeoutMinutesInput: '5',
      visionCatalog: []
    })
  })

  it('clears visible conversation before backend deletion finishes', async () => {
    let resolveClear: (value: { cleared: number }) => void = () => undefined
    const clearPromise = new Promise<{ cleared: number }>(resolve => {
      resolveClear = resolve
    })
    jest.mocked(actions.clearAdHocAiAutomationRunsAction).mockReturnValue(clearPromise)

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

  it('keeps transcript position when history arrives after the user scrolled up', async () => {
    let resolveHistory: (
      value: Awaited<ReturnType<typeof actions.listAdHocAiAutomationRunHistoryAction>>
    ) => void = () => undefined
    jest.mocked(actions.listAdHocAiAutomationRunHistoryAction).mockReturnValue(
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
    jest.mocked(actions.listAdHocAiAutomationRunHistoryAction).mockReturnValue(
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
    expect(transcript.scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' })
  })

  it('starts an explicitly approved follow-up with one-run shell escalation', async () => {
    jest.mocked(actions.runAdHocAiAutomationAction).mockResolvedValue(run)
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

  it('keeps stopped-device prompt drafts from starting a run', async () => {
    const { result } = renderHook(() => useAiAgentChatSession({ app: { ...app, running: false } }))
    await waitFor(() => expect(result.current.turns).toHaveLength(1))

    await act(async () => {
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
  const scrollTo = jest.fn((options?: ScrollToOptions) => {
    if (typeof options?.top === 'number') element.scrollTop = options.top
  })
  Object.defineProperty(element, 'scrollTo', { configurable: true, value: scrollTo })
  return { element, scrollTo }
}
