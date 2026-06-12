import { createRef } from 'react'
import { describe, expect, it, jest } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { AiAgentToolsSection } from './ai-agent-tools-section'
import { useAiAgentChatSession } from './use-ai-agent-chat-session'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

jest.mock('./use-ai-agent-chat-session', () => ({
  useAiAgentChatSession: jest.fn()
}))

jest.mock('./ai-agent-settings-popover', () => ({
  AiAgentModelStatus: () => <div>No model selected</div>,
  AiAgentSettingsPopover: () => <button type='button'>Settings</button>
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
    expect(screen.getByPlaceholderText('Ask the AI to perform a task, call a tool, or take an action...')).toBeTruthy()
  })

  it('shows an empty ready state when there are no turns', () => {
    jest.mocked(useAiAgentChatSession).mockReturnValue(chatSession())

    render(<AiAgentToolsSection app={app} />)

    expect(screen.getByText('AI agent ready')).toBeTruthy()
    expect(screen.queryByLabelText('Loading AI chat history')).toBeNull()
  })
})
