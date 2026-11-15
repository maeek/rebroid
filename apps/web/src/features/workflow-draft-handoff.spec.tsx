import { useState, type ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AutomationEditorPage } from '@/features/automations/automations-page/editor/automation-editor-page'
import { buildYaml, definitionToForm } from '@/features/automations/automations-page/editor/builder-utils'
import { validateAutomationYamlAction } from '@/server/orchestrator/automations/automation-management-actions'
import { FeatureFlagsProvider } from '@/shared/model/features/feature-flags-context'
import { ChatTurnSaveWorkflowAction } from './applications/viewer/tools/runtime-tools-panel/ai-agent/ai-agent-chat-turn-save-action'
import { useAiAgentWorkflowDraft } from './applications/viewer/tools/runtime-tools-panel/ai-agent/use-ai-agent-workflow-draft'
import type { ChatTurn } from './applications/viewer/tools/runtime-tools-panel/ai-agent/ai-agent-chat-utils'
import type { AutomationAiModelCatalogProvider } from '@/shared/contracts/ai-provider'
import type { AutomationDefinition } from '@rebroid/automation-core/definition'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/server/orchestrator/automations/automation-management-actions', () => ({
  validateAutomationYamlAction: vi.fn()
}))
vi.mock('@/features/automations/automations-page/editor/automation-yaml-editor-section', () => ({
  AutomationYamlEditorSection: ({ yaml }: { yaml: string }) => (
    <textarea
      aria-label='Workflow YAML'
      value={yaml}
      readOnly
    />
  )
}))

const turn = {
  id: 'turn-1',
  prompt: 'Open Settings',
  status: 'success',
  run: {
    id: 'run-1',
    automationId: 'automation-1',
    automationTriggerId: null,
    ownerUserId: 'owner-1',
    targetApplicationId: 'app-1',
    targetProfileMode: null,
    targetProfileName: null,
    trigger: 'manual',
    status: 'success',
    startedAt: null,
    completedAt: null,
    stepResults: [],
    error: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  events: [
    {
      id: 'event-1',
      runId: 'run-1',
      ownerUserId: 'owner-1',
      sequence: 1,
      type: 'ai.user.message',
      stepId: null,
      parentStepId: null,
      message: 'Open Settings',
      data: { clientMessageId: 'turn-1' },
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'event-2',
      runId: 'run-1',
      ownerUserId: 'owner-1',
      sequence: 2,
      type: 'ai.message.completed',
      stepId: null,
      parentStepId: null,
      message: 'Settings is open.',
      data: { completed: true },
      createdAt: '2026-01-01T00:00:01.000Z'
    }
  ]
} satisfies ChatTurn

describe('ChatTurnSaveWorkflowAction', () => {
  it('does not offer workflow drafting for a blocked AI task', () => {
    render(
      <ChatTurnSaveWorkflowAction
        turn={{
          ...turn,
          events: turn.events.map(event =>
            event.type === 'ai.message.completed' ? { ...event, data: { completed: false } } : event
          )
        }}
      />
    )
    expect(screen.queryByRole('button', { name: 'Draft workflow' })).toBeNull()
  })

  it('copies the final response and keeps workflow drafting available', async () => {
    const writeText = vi.fn<(value: string) => Promise<void>>(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const onSaveWorkflow = vi.fn()
    render(
      <ChatTurnSaveWorkflowAction
        turn={turn}
        onSaveWorkflow={onSaveWorkflow}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Settings is open.'))
    expect(await screen.findByRole('button', { name: 'Copied' })).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Draft workflow' }))
    expect(onSaveWorkflow).toHaveBeenCalledWith(turn)
  })

  it('opens a completed run’s draft in the workflow editor and consumes the handoff once', async () => {
    const definition: AutomationDefinition = {
      apiVersion: 'rebroid.io/automation/v1',
      kind: 'AndroidAutomation',
      metadata: { name: 'Open Android Settings' },
      spec: { steps: [{ id: 'settings', uses: 'debug.log', with: { message: 'Settings is open.' } }] }
    }
    const yaml = buildYaml(definitionToForm(definition))
    const provider: AutomationAiModelCatalogProvider = {
      id: 'provider-1',
      label: 'Test provider',
      kind: 'ollama',
      models: [{ id: 'model-1', label: 'Test model', roles: ['planner'], settings: {}, enabled: true, defaultFor: [] }]
    }
    const draftWorkflowFromRun = vi.fn().mockResolvedValue({ yaml, definition })
    vi.mocked(validateAutomationYamlAction).mockResolvedValue({ valid: true, errors: [], definition, yaml })

    function DraftHandoff() {
      const [open, setOpen] = useState(false)
      const { saveTurnAsWorkflow } = useAiAgentWorkflowDraft({
        draftWorkflowFromRun,
        openWorkflowDraft: () => setOpen(true),
        selectedProvider: provider,
        selectedModel: provider.models[0],
        selectedVisionProvider: undefined,
        selectedVisionModel: undefined
      })
      return open ? (
        <AutomationEditorPage
          initialCommands={[]}
          canUseAi={false}
          canManageAi={false}
        />
      ) : (
        <ChatTurnSaveWorkflowAction
          turn={turn}
          onSaveWorkflow={draftTurn => void saveTurnAsWorkflow(draftTurn)}
        />
      )
    }

    const wrapper = ({ children }: { children: ReactNode }) => (
      <FeatureFlagsProvider manifest={null}>{children}</FeatureFlagsProvider>
    )
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    }))
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      }
    )
    try {
      const view = render(<DraftHandoff />, { wrapper })
      fireEvent.click(screen.getByRole('button', { name: 'Draft workflow' }))
      expect(await screen.findByRole('heading', { name: 'Open Android Settings' })).toBeVisible()
      expect(screen.getByRole('textbox', { name: 'Workflow YAML' })).toHaveValue(yaml)
      expect(draftWorkflowFromRun).toHaveBeenCalledExactlyOnceWith({
        runId: 'run-1',
        providerId: 'provider-1',
        modelId: 'model-1'
      })
      expect(validateAutomationYamlAction).toHaveBeenCalledWith(yaml)

      view.unmount()
      render(
        <AutomationEditorPage
          initialCommands={[]}
          canUseAi={false}
          canManageAi={false}
        />,
        { wrapper }
      )
      expect(screen.getByRole('heading', { name: 'New workflow' })).toBeVisible()
      expect(screen.queryByRole('textbox', { name: 'Workflow YAML' })).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
