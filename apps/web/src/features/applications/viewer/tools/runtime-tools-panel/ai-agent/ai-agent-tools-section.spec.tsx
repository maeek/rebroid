import { createRef } from 'react'
import { describe, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react'
import { AiAgentToolsSection } from './ai-agent-tools-section'
import { useAiAgentChatSession } from './use-ai-agent-chat-session'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { AiPromptSuggestion, SuggestAdHocAiPromptsInput } from '@/server/orchestrator/automations/types'

jest.mock('./use-ai-agent-chat-session', () => ({
  useAiAgentChatSession: jest.fn()
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
  onTranscriptScroll: jest.fn(),
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
  setModelId: jest.fn(),
  setPrompt: jest.fn(),
  setProviderId: jest.fn(),
  setTimeoutMinutesInput: jest.fn(),
  setVisionModelId: jest.fn(),
  setVisionProviderId: jest.fn(),
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
    jest.mocked(useAiAgentChatSession).mockReturnValue(chatSession({ isLoadingHistory: true }))

    render(<AiAgentToolsSection app={app} />)

    expect(screen.getByLabelText('Loading AI chat history')).toBeTruthy()
    expect(screen.getByPlaceholderText('Describe what you want to accomplish…')).toBeTruthy()
    expect(screen.getByText('No model')).toBeTruthy()
  })

  it('shows an empty ready state when there are no turns', () => {
    jest.mocked(useAiAgentChatSession).mockReturnValue(chatSession())

    render(<AiAgentToolsSection app={app} />)

    expect(screen.getByText('What should I do on this device?')).toBeTruthy()
    expect(screen.getByText('No model')).toBeTruthy()
    expect(screen.queryByLabelText('Loading AI chat history')).toBeNull()
  })

  it('uses the transcript as the desktop scroll area', () => {
    jest.mocked(useAiAgentChatSession).mockReturnValue(chatSession())

    render(<AiAgentToolsSection app={app} />)

    const transcript = screen.getByLabelText('AI agent transcript')
    const section = screen.getByTestId('ai-agent-tools-section')

    expect(transcript.className).toContain('flex-1')
    expect(transcript.className).toContain('overflow-y-auto')
    expect(section.className).toContain('h-full')
    expect(section.className).toContain('overflow-hidden')
  })

  it('keeps clear available and delegates clearing to the session', () => {
    const clearConversation = jest.fn<() => Promise<void>>(() => Promise.resolve())
    jest.mocked(useAiAgentChatSession).mockReturnValue(
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
    const generatePromptSuggestions = jest.fn<
      (input: SuggestAdHocAiPromptsInput) => Promise<{ suggestions: AiPromptSuggestion[] }>
    >(() =>
      Promise.resolve({
        suggestions: [{ id: 'dynamic', label: 'Dynamic chip', prompt: 'Inspect the current screen.' }]
      })
    )
    jest.mocked(useAiAgentChatSession).mockReturnValue(
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
    expect(screen.getByRole('button', { name: 'Dynamic chip' }).className).toContain('border-border/45')
    expect(screen.getByRole('button', { name: 'Dynamic chip' }).className).toContain('font-normal')
    expect(generatePromptSuggestions.mock.calls[0]?.[0]).toMatchObject({ targetApplicationId: app.id })
  })

  it('exports visible conversation turns as debug json', async () => {
    const createObjectURL = jest.fn((_object: Blob | MediaSource) => 'blob:debug-export')
    const revokeObjectURL = jest.fn()
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
    jest.mocked(useAiAgentChatSession).mockReturnValue(
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

    render(<AiAgentToolsSection app={app} />)

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
    const generatePromptSuggestions = jest.fn<
      (input: SuggestAdHocAiPromptsInput) => Promise<{ suggestions: AiPromptSuggestion[] }>
    >(() => Promise.resolve({ suggestions: [] }))
    jest.mocked(useAiAgentChatSession).mockReturnValue(
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
