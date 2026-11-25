import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AiAgentToolsSection } from './ai-agent-tools-section'
import { useAiAgentChatSession } from './use-ai-agent-chat-session'
import type { ChatTurn } from './ai-agent-chat-utils'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { AiPromptSuggestion, SuggestAdHocAiPromptsInput } from '@/shared/contracts/automation'

vi.mock('./use-ai-agent-chat-session', () => ({
  useAiAgentChatSession: vi.fn()
}))

const app: AppDefinition = {
  id: 'app_1',
  name: 'Scooby doo',
  icon: null,
  running: true,
  status: 'running',
  lifecycleStage: 'ready',
  statusMessage: null,
  statusDetail: null,
  ownerUserId: 'user_1',
  containerImage: 'redroid:13',
  containerName: 'rebroid-app-1',
  containerId: 'container_1',
  networkName: 'rebroid',
  volumeName: 'rebroid-app-1',
  profileName: null,
  memoryLimitMb: null,
  cpuLimitCpus: null,
  containerArgs: null,
  recreateContainerOnNextStart: false,
  networkPolicyEnabled: false,
  networkPolicyAllowCidrs: [],
  networkPolicyResult: null,
  networkPolicyAppliedAt: null,
  apkOriginalName: null,
  apkPackageName: null,
  apkFilePath: null,
  uploadedApkId: null,
  scrcpyTransport: 'webrtc',
  adbPort: 5555,
  inactivityTimeoutSeconds: 300,
  lastError: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  imagePullProgress: null,
  applicationError: null,
  apk: {
    version: ''
  },
  profileMode: 'temporary',
  savedProfiles: []
}

type ChatSession = ReturnType<typeof useAiAgentChatSession>

const chatSession = ({
  modelSettings,
  ...patch
}: Partial<Omit<ChatSession, 'modelSettings'>> & {
  modelSettings?: Partial<ChatSession['modelSettings']>
} = {}): ChatSession => ({
  modelSettings: {
    adHocTimeoutMinutes: 5,
    adHocTimeoutMs: 300_000,
    catalog: [],
    health: null,
    isCheckingHealth: false,
    primaryCatalog: [],
    recheckHealth: () => Promise.resolve(undefined),
    selectedModel: undefined,
    selectedProvider: undefined,
    selectedVisionModel: undefined,
    selectedVisionProvider: undefined,
    selectionMessage: 'Configure an enabled AI provider and model before sending.',
    selectPrimaryModel: vi.fn(),
    setTimeoutMinutesInput: vi.fn(),
    setVisionModelId: vi.fn(),
    setVisionProviderId: vi.fn(),
    timeoutMinutesInput: '5',
    visionCatalog: [],
    isLoadingCatalog: false,
    ...modelSettings
  },
  activeTurn: null,
  canSubmit: false,
  canRunQueuedTurn: false,
  cancelRun: () => Promise.resolve(undefined),
  clearConversation: () => Promise.resolve(undefined),
  error: null,
  historyLoadFailed: false,
  retryHistory: vi.fn(),
  isCanceling: false,
  isClearing: false,
  isLoadingHistory: false,
  isAtBottom: true,
  scrollToLatest: vi.fn(),
  onTranscriptScroll: vi.fn(),
  prompt: '',
  queuedTurn: undefined,
  runQueuedTurn: () => Promise.resolve(undefined),
  setPrompt: vi.fn(),
  showCancelRun: undefined,
  submissionFeedback: null,
  submit: () => Promise.resolve(undefined),
  submitPrompt: () => Promise.resolve(undefined),
  transcriptRef: createRef<HTMLDivElement>(),
  turns: [],
  ...patch
})

describe('AiAgentToolsSection', () => {
  it('shows the composer while chat history is loading', () => {
    vi.mocked(useAiAgentChatSession).mockReturnValue(chatSession({ isLoadingHistory: true }))

    render(<AiAgentToolsSection app={app} />)

    expect(screen.getByLabelText('Loading AI chat history')).toBeTruthy()
    expect(screen.getByPlaceholderText('Describe a task for this Android device…')).toBeTruthy()
    expect(screen.getByText('No model')).toBeTruthy()
  })

  it('keeps the submitted prompt visible during history loading and a failed history read', () => {
    const retryHistory = vi.fn()
    const turns: ReturnType<typeof useAiAgentChatSession>['turns'] = [
      { id: 'waiting', prompt: 'Open settings', status: 'waiting-for-history', run: null, events: [] }
    ]
    vi.mocked(useAiAgentChatSession).mockReturnValue(chatSession({ isLoadingHistory: true, turns, retryHistory }))
    const view = render(<AiAgentToolsSection app={app} />)
    expect(screen.getByText('Open settings')).toBeVisible()
    expect(screen.getByText('Waiting for chat history')).toBeVisible()

    vi.mocked(useAiAgentChatSession).mockReturnValue(chatSession({ historyLoadFailed: true, turns, retryHistory }))
    view.rerender(<AiAgentToolsSection app={app} />)
    expect(screen.getByText('Open settings')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Retry history' }))
    expect(retryHistory).toHaveBeenCalledOnce()
  })

  it('shows an empty ready state when there are no turns', () => {
    vi.mocked(useAiAgentChatSession).mockReturnValue(chatSession())

    render(<AiAgentToolsSection app={app} />)

    expect(screen.getByText('Give the device agent a task')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Inspect screen' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Suggestions' })).toBeNull()
    expect(screen.getByText('No model')).toBeTruthy()
    expect(screen.queryByLabelText('Loading AI chat history')).toBeNull()
  })

  it('keeps history and settings visible but pauses device actions while stopped', () => {
    vi.mocked(useAiAgentChatSession).mockReturnValue(
      chatSession({
        canSubmit: true,
        prompt: 'Open settings'
      })
    )

    render(<AiAgentToolsSection app={{ ...app, running: false, status: 'stopped' }} />)

    expect(screen.getByText('Configure an enabled AI provider and model before sending.')).toBeTruthy()
    expect(screen.getByRole('textbox').hasAttribute('disabled')).toBe(false)
    expect(screen.getByRole('button', { name: 'Send message' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('No model')).toBeTruthy()
  })

  it('shows when the oldest queued task can be started and keeps dispatch explicit', () => {
    const queued: ChatTurn = { id: 'queued', prompt: 'Check the display', status: 'queued', run: null, events: [] }
    const later: ChatTurn = { ...queued, id: 'later', prompt: 'Open Settings' }
    const runQueuedTurn = vi.fn(async () => {})
    const active: ChatTurn = { ...queued, id: 'active', status: 'running' }
    const session = { queuedTurn: queued, turns: [queued, later], runQueuedTurn }
    vi.mocked(useAiAgentChatSession).mockReturnValue(chatSession({ ...session, activeTurn: active }))
    const { rerender } = render(<AiAgentToolsSection app={app} />)
    expect(screen.getByText('Queued behind the current task.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Run next task' })).toBeNull()

    vi.mocked(useAiAgentChatSession).mockReturnValue(chatSession({ ...session, canRunQueuedTurn: true }))
    rerender(<AiAgentToolsSection app={app} />)
    expect(screen.getByText(/Ready to run/)).toBeVisible()
    expect(screen.getByText('Queued behind earlier tasks.')).toBeVisible()
    expect(runQueuedTurn).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Run next task' }))
    expect(runQueuedTurn).toHaveBeenCalledOnce()
  })

  it('shows a failed task with no events without saying it is starting', () => {
    vi.mocked(useAiAgentChatSession).mockReturnValue(
      chatSession({
        turns: [
          {
            id: 'failed',
            prompt: 'Check the display',
            status: 'failed',
            run: null,
            events: [],
            error: 'Device disconnected.'
          }
        ]
      })
    )
    render(<AiAgentToolsSection app={app} />)
    expect(screen.getByText('Device disconnected.')).toBeVisible()
    expect(screen.queryByText(/Waiting for the agent|Starting the task/)).toBeNull()
  })

  it('uses the transcript as the desktop scroll area', () => {
    vi.mocked(useAiAgentChatSession).mockReturnValue(chatSession())

    render(<AiAgentToolsSection app={app} />)

    const transcript = screen.getByLabelText('AI agent transcript')
    const section = screen.getByTestId('ai-agent-tools-section')

    expect(transcript.className).toContain('flex-1')
    expect(transcript.className).toContain('overflow-y-auto')
    expect(section.className).toContain('h-full')
    expect(section.className).toContain('overflow-hidden')
  })

  it('does not submit a stopped device draft using Enter', () => {
    const submit = vi.fn()
    vi.mocked(useAiAgentChatSession).mockReturnValue(chatSession({ canSubmit: true, submit }))
    render(<AiAgentToolsSection app={{ ...app, running: false }} />)
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Message the device agent' }), { key: 'Enter' })
    expect(submit).not.toHaveBeenCalled()
  })

  it('returns to the latest messages without moving the page', () => {
    const scrollToLatest = vi.fn()
    vi.mocked(useAiAgentChatSession).mockReturnValue(chatSession({ isAtBottom: false, scrollToLatest }))
    render(<AiAgentToolsSection app={app} />)
    fireEvent.click(screen.getByRole('button', { name: 'Latest messages' }))
    expect(scrollToLatest).toHaveBeenCalledOnce()
  })

  it('keeps clear available and delegates clearing to the session', async () => {
    const clearConversation = vi.fn<() => Promise<void>>(() => Promise.resolve())
    vi.mocked(useAiAgentChatSession).mockReturnValue(
      chatSession({
        clearConversation,
        turns: [
          {
            id: 'turn_1',
            prompt: 'Find Downloads',
            status: 'success',
            run: null,
            events: []
          }
        ]
      })
    )

    render(<AiAgentToolsSection app={app} />)

    fireEvent.click(screen.getByRole('button', { name: 'Conversation actions' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /clear/i }))

    expect(clearConversation).toHaveBeenCalledTimes(1)
  })

  it('renders generated contextual suggestions when enabled', async () => {
    const generatePromptSuggestions = vi.fn<
      (input: SuggestAdHocAiPromptsInput) => Promise<{ suggestions: AiPromptSuggestion[] }>
    >(() =>
      Promise.resolve({
        suggestions: [{ id: 'dynamic', label: 'Dynamic chip', prompt: 'Inspect the current screen.' }]
      })
    )
    const deviceModel = {
      id: 'device',
      label: 'Device control',
      roles: ['controller'] as const,
      enabled: true,
      defaultFor: [],
      settings: {}
    }
    const selectedModel = { ...deviceModel, roles: [...deviceModel.roles] }
    const selectedProvider = {
      id: 'device-provider',
      label: 'Device',
      kind: 'ollama' as const,
      models: [selectedModel]
    }
    vi.mocked(useAiAgentChatSession).mockReturnValue(
      chatSession({
        modelSettings: {
          selectedProvider,
          selectedModel,
          catalog: [
            selectedProvider,
            {
              id: 'planner-provider',
              label: 'Planning',
              kind: 'ollama',
              models: [
                { ...selectedModel, id: 'planner:exact', roles: ['controller', 'planner'], defaultFor: ['planner'] }
              ]
            }
          ]
        }
      })
    )

    render(
      <AiAgentToolsSection
        app={app}
        generatePromptSuggestions={generatePromptSuggestions}
      />
    )

    expect(await screen.findByText('Dynamic chip')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Dynamic chip' }).className).toContain('font-normal')
    expect(generatePromptSuggestions.mock.calls[0]?.[0]).toMatchObject({
      targetDeviceId: app.id,
      providerId: 'planner-provider',
      modelId: 'planner:exact'
    })
  })

  it('exports visible conversation turns as debug json', async () => {
    const createObjectURL = vi.fn((_object: Blob | MediaSource) => 'blob:debug-export')
    const revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
    vi.mocked(useAiAgentChatSession).mockReturnValue(
      chatSession({
        modelSettings: {
          selectedProvider: { id: 'provider_1', label: 'Provider', kind: 'ollama', models: [] },
          selectedModel: {
            id: 'model_1',
            label: 'Model',
            roles: ['planner'],
            enabled: true,
            defaultFor: ['planner'],
            settings: {}
          }
        },
        turns: [
          {
            id: 'turn_1',
            prompt: 'Turn on dark mode',
            status: 'success',
            run: null,
            events: []
          }
        ]
      })
    )

    render(<AiAgentToolsSection app={app} />)

    fireEvent.click(screen.getByRole('button', { name: 'Conversation actions' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /export/i }))

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const exportedObject = createObjectURL.mock.calls[0]?.[0]
    expect(exportedObject).toBeInstanceOf(Blob)
    const blob = exportedObject as Blob
    const payload = JSON.parse(await readBlobText(blob)) as { app: { id: string }; turns: Array<{ prompt: string }> }
    expect(payload.app.id).toBe(app.id)
    expect(payload.turns[0]?.prompt).toBe('Turn on dark mode')
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:debug-export')
    click.mockRestore()
  })

  it('uses static suggestions when contextual generation is disabled', () => {
    const generatePromptSuggestions = vi.fn<
      (input: SuggestAdHocAiPromptsInput) => Promise<{ suggestions: AiPromptSuggestion[] }>
    >(() => Promise.resolve({ suggestions: [] }))
    vi.mocked(useAiAgentChatSession).mockReturnValue(
      chatSession({
        modelSettings: {
          selectedProvider: { id: 'provider_1', label: 'Provider', kind: 'ollama', models: [] },
          selectedModel: {
            id: 'model_1',
            label: 'Model',
            roles: ['planner'],
            enabled: true,
            defaultFor: ['planner'],
            settings: {}
          }
        }
      })
    )

    render(
      <AiAgentToolsSection
        app={app}
        contextualSuggestionsEnabled={false}
        generatePromptSuggestions={generatePromptSuggestions}
      />
    )

    expect(screen.getByText('Inspect screen')).toBeTruthy()
    expect(screen.getByText('Open Settings')).toBeTruthy()
    expect(generatePromptSuggestions).not.toHaveBeenCalled()
  })
})

const readBlobText = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('Expected blob text result.'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Could not read blob.'))
    reader.readAsText(blob)
  })
