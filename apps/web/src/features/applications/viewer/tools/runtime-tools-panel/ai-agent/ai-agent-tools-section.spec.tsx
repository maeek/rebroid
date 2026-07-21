import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AiAgentToolsSection } from './ai-agent-tools-section'
import { useAiAgentChatSession } from './use-ai-agent-chat-session'
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
  networkPolicyStatus: null,
  networkPolicyMessage: null,
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

const chatSession = (
  patch: Partial<ReturnType<typeof useAiAgentChatSession>> = {}
): ReturnType<typeof useAiAgentChatSession> => ({
  activeTurn: null,
  adHocTimeoutMinutes: 5,
  adHocTimeoutMs: 300_000,
  canSubmit: false,
  cancelRun: () => Promise.resolve(undefined),
  catalog: [],
  clearConversation: () => Promise.resolve(undefined),
  error: null,
  health: null,
  isCanceling: false,
  isCheckingHealth: false,
  isClearing: false,
  isLoadingHistory: false,
  onTranscriptScroll: vi.fn(),
  plannerCatalog: [],
  prompt: '',
  queuedTurn: undefined,
  recheckHealth: () => Promise.resolve(undefined),
  runQueuedTurn: () => Promise.resolve(undefined),
  selectedModel: undefined,
  selectedProvider: undefined,
  selectedVisionModel: undefined,
  selectedVisionProvider: undefined,
  selectionMessage: 'Configure an enabled AI provider and model before sending.',
  setModelId: vi.fn(),
  setPrompt: vi.fn(),
  setProviderId: vi.fn(),
  setTimeoutMinutesInput: vi.fn(),
  setVisionModelId: vi.fn(),
  setVisionProviderId: vi.fn(),
  showCancelRun: undefined,
  submit: () => Promise.resolve(undefined),
  submitPrompt: () => Promise.resolve(undefined),
  timeoutMinutesInput: '5',
  transcriptRef: createRef<HTMLDivElement>(),
  turns: [],
  visionCatalog: [],
  ...patch
})

describe('AiAgentToolsSection', () => {
  it('shows the composer while chat history is loading', () => {
    vi.mocked(useAiAgentChatSession).mockReturnValue(chatSession({ isLoadingHistory: true }))

    render(<AiAgentToolsSection app={app} />)

    expect(screen.getByLabelText('Loading AI chat history')).toBeTruthy()
    expect(screen.getByPlaceholderText('Describe what you want to accomplish…')).toBeTruthy()
    expect(screen.getByText('No model')).toBeTruthy()
  })

  it('shows an empty ready state when there are no turns', () => {
    vi.mocked(useAiAgentChatSession).mockReturnValue(chatSession())

    render(<AiAgentToolsSection app={app} />)

    expect(screen.getByText('What should I do on this device?')).toBeTruthy()
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

    render(
      <AiAgentToolsSection
        app={{ ...app, running: false, status: 'stopped' }}
        hideHeader
      />
    )

    expect(screen.getByText('Device actions are paused')).toBeTruthy()
    expect(screen.getByText(/Review history, configure the model, or draft the next request/)).toBeTruthy()
    expect(screen.getByRole('textbox').hasAttribute('disabled')).toBe(false)
    expect(screen.getByRole('button', { name: 'Send message' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('No model')).toBeTruthy()
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

  it('keeps the inline composer dock transparent', () => {
    vi.mocked(useAiAgentChatSession).mockReturnValue(chatSession())

    render(<AiAgentToolsSection app={app} />)

    const composerDock = screen.getByTestId('ai-agent-composer-dock')

    expect(composerDock.className).toContain('bg-transparent')
    expect(composerDock.className).toContain('px-0')
    expect(composerDock.className).toContain('sm:px-4')
    expect(composerDock.className).not.toContain('bg-background')
    expect(composerDock.className).not.toContain('backdrop-blur')
  })

  it('keeps clear available and delegates clearing to the session', () => {
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

    fireEvent.click(screen.getByRole('button', { name: /clear/i }))

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
    vi.mocked(useAiAgentChatSession).mockReturnValue(
      chatSession({
        selectedProvider: { id: 'provider_1', label: 'Provider', kind: 'ollama', models: [] },
        selectedModel: {
          id: 'model_1',
          label: 'Model',
          roles: ['planner'],
          enabled: true,
          defaultFor: ['planner'],
          settings: {}
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
    expect(screen.getByRole('button', { name: 'Dynamic chip' }).className).toContain('border-surface-border/45')
    expect(screen.getByRole('button', { name: 'Dynamic chip' }).className).toContain('font-normal')
    expect(generatePromptSuggestions.mock.calls[0]?.[0]).toMatchObject({ targetApplicationId: app.id })
  })

  it('exports visible conversation turns as debug json', async () => {
    const createObjectURL = vi.fn((_object: Blob | MediaSource) => 'blob:debug-export')
    const revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
    vi.mocked(useAiAgentChatSession).mockReturnValue(
      chatSession({
        selectedProvider: { id: 'provider_1', label: 'Provider', kind: 'ollama', models: [] },
        selectedModel: {
          id: 'model_1',
          label: 'Model',
          roles: ['planner'],
          enabled: true,
          defaultFor: ['planner'],
          settings: {}
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

    render(
      <AiAgentToolsSection
        app={app}
        hideHeader
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /export/i }))

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
        selectedProvider: { id: 'provider_1', label: 'Provider', kind: 'ollama', models: [] },
        selectedModel: {
          id: 'model_1',
          label: 'Model',
          roles: ['planner'],
          enabled: true,
          defaultFor: ['planner'],
          settings: {}
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
