import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
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
      selectedModel: { id: 'model_1', label: 'Model', roles: ['planner'], enabled: true, default: true, settings: {} },
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
})
