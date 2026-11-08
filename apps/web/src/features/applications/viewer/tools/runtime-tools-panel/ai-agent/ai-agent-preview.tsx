'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useApplicationViewerApp } from '@/features/applications/detail/application-viewer-context'
import { AiAgentConversation } from './ai-agent-tools-section'
import { useAiAgentTranscriptScroll } from './use-ai-agent-transcript-scroll'
import type { ChatTurn } from './ai-agent-chat-utils'
import type { AutomationAiModelCatalogProvider } from '@/shared/contracts/ai-provider'

const provider: AutomationAiModelCatalogProvider = {
  id: 'local',
  label: 'Local provider',
  kind: 'ollama',
  models: [
    {
      id: 'device-agent',
      label: 'Device agent',
      enabled: true,
      roles: ['planner'],
      defaultFor: ['planner'],
      settings: {}
    }
  ]
}

const completedTurn = (
  index: number,
  prompt = 'Open Settings and check the current display preferences.'
): ChatTurn => ({
  id: `turn-${index}`,
  prompt,
  status: 'success',
  run: null,
  events: [
    {
      id: `event-${index}`,
      runId: `run-${index}`,
      ownerUserId: 'preview-owner',
      sequence: 1,
      type: 'ai.message.completed',
      stepId: null,
      parentStepId: null,
      createdAt: '2026-11-08T10:00:00Z',
      message:
        'Opened **Settings** and verified the display preferences.\n\n- Brightness is set to automatic.\n- Dark theme is enabled.\n\nThe device is ready for your next request.',
      data: {}
    }
  ]
})

export const AiAgentPreview = () => {
  const { app: storedApp } = useApplicationViewerApp()
  const state = useSearchParams().get('conversation') ?? 'empty'
  const app = { ...storedApp, running: state !== 'stopped' && state !== 'no-model' }
  const [prompt, setPrompt] = useState('')
  const [timeout, setTimeout] = useState('5')
  const [turns, setTurns] = useState<ChatTurn[]>(() => {
    if (state === 'history') return Array.from({ length: 15 }, (_, index) => completedTurn(index))
    if (state === 'working') return [{ ...completedTurn(0), status: 'running' }]
    return []
  })
  const scroll = useAiAgentTranscriptScroll(turns)
  const model = state === 'no-model' ? undefined : provider.models[0]
  const selectedProvider = model ? provider : undefined
  const activeTurn = turns.find(turn => turn.status === 'running') ?? null
  const submit = () => {
    if (!app.running || !model || !prompt.trim()) return Promise.resolve()
    setTurns(current => [...current, completedTurn(current.length, prompt)])
    setPrompt('')
    return Promise.resolve()
  }
  const noop = () => undefined
  return (
    <AiAgentConversation
      app={app}
      contextualSuggestionsEnabled={false}
      session={{
        ...scroll,
        activeTurn,
        adHocTimeoutMinutes: Number(timeout) || 5,
        adHocTimeoutMs: (Number(timeout) || 5) * 60_000,
        canSubmit: Boolean(model && prompt.trim()),
        cancelRun: () => Promise.resolve(setTurns(current => current.map(turn => ({ ...turn, status: 'canceled' })))),
        catalog: model ? [provider] : [],
        clearConversation: () => Promise.resolve(setTurns([])),
        error: null,
        health: null,
        isCanceling: false,
        isCheckingHealth: false,
        isClearing: false,
        isLoadingHistory: state === 'loading',
        plannerCatalog: model ? [provider] : [],
        prompt,
        queuedTurn: undefined,
        recheckHealth: () => Promise.resolve(),
        selectedModel: model,
        selectedProvider,
        selectedVisionModel: undefined,
        selectedVisionProvider: undefined,
        selectionMessage: model ? null : 'Configure an enabled AI provider and model before sending.',
        setModelId: noop,
        setPrompt,
        setProviderId: noop,
        setTimeoutMinutesInput: setTimeout,
        setVisionModelId: noop,
        setVisionProviderId: noop,
        showCancelRun: Boolean(activeTurn),
        submit,
        submitPrompt: () => Promise.resolve(),
        timeoutMinutesInput: timeout,
        turns,
        visionCatalog: [],
        runQueuedTurn: () => Promise.resolve()
      }}
    />
  )
}
