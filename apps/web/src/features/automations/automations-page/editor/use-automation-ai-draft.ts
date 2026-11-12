'use client'

import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { readAutomationDraftStream } from '@/shared/model/automation-draft/read-automation-draft-stream'
import { definitionToForm } from './builder-utils'
import { useAiDraftModelSelection } from './use-ai-draft-model-selection'
import type { EditorSnapshot } from './use-automation-editor-history'
import type { DraftAutomationYamlInput } from '@/shared/contracts/automation'
import type { AutomationYamlDraft, AutomationYamlDraftStreamEvent } from '@rebroid/automation-core/yaml-draft'

export type AiDraftStatus = 'idle' | 'running' | 'needs-input' | 'completed' | 'failed'

export interface AiDraftLogItem {
  id: string
  type: AutomationYamlDraftStreamEvent['type'] | 'draft.canceled'
  message: string
}

const eventId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

const responseErrorMessage = async (response: Response) => {
  const error = (await response.json().catch(() => null)) as { message?: unknown } | null
  return typeof error?.message === 'string' ? error.message : response.statusText || 'Draft request failed.'
}

export const useAutomationAiDraft = ({
  commitEditorChange,
  setBusy,
  setYamlError,
  setYamlValid,
  canUseAi,
  workflowId
}: {
  commitEditorChange: (update: () => EditorSnapshot) => void
  setBusy: Dispatch<SetStateAction<boolean>>
  setYamlError: Dispatch<SetStateAction<string | null>>
  setYamlValid: Dispatch<SetStateAction<boolean>>
  canUseAi: boolean
  workflowId: string | null
}) => {
  const [aiDraftOpen, setAiDraftOpenState] = useState(false)
  const [aiDraftPrompt, setAiDraftPrompt] = useState('')
  const [aiDraftStatus, setAiDraftStatus] = useState<AiDraftStatus>('idle')
  const [aiDraftLog, setAiDraftLog] = useState<AiDraftLogItem[]>([])
  const [aiDraftResult, setAiDraftResult] = useState<AutomationYamlDraft | null>(null)
  const [aiDraftError, setAiDraftError] = useState<string | null>(null)
  const [aiDraftClarificationQuestion, setAiDraftClarificationQuestion] = useState<string | null>(null)
  const [aiDraftClarificationAnswer, setAiDraftClarificationAnswer] = useState('')
  const [clarifications, setClarifications] = useState<Array<{ question: string; answer: string }>>([])
  const abortRef = useRef<AbortController | null>(null)
  const {
    canDraftFromPrompt,
    catalog: aiModelCatalog,
    catalogStatus,
    model: selectedAiDraftModel,
    provider: selectedAiDraftProvider,
    setModelId: setAiDraftModelId,
    setProviderId: setAiDraftProviderId
  } = useAiDraftModelSelection(canUseAi)

  const appendLog = (type: AiDraftLogItem['type'], message: string) => {
    if (!message.trim()) return
    setAiDraftLog(current => [...current, { id: eventId(), type, message }].slice(-18))
  }

  const cancelDraft = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setBusy(false)
    setAiDraftStatus('idle')
    appendLog('draft.canceled', 'Draft generation was canceled.')
  }

  const resetDraftState = () => {
    setAiDraftStatus('idle')
    setAiDraftError(null)
    setAiDraftLog([])
    setAiDraftResult(null)
    setAiDraftClarificationQuestion(null)
    setAiDraftClarificationAnswer('')
    setClarifications([])
  }

  const setAiDraftOpen = (open: boolean) => {
    if (!open && abortRef.current) cancelDraft()
    if (open) resetDraftState()
    setAiDraftOpenState(open)
  }

  const consumeDraftStream = async (input: DraftAutomationYamlInput, signal: AbortSignal) => {
    const response = await fetch('/api/automations/draft-yaml/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal
    })
    if (!response.ok) throw new Error(await responseErrorMessage(response))
    const outcome = await readAutomationDraftStream(response.body, {
      signal,
      onEvent: event => appendLog(event.type, event.message)
    })
    signal.throwIfAborted()
    if (outcome.type === 'draft.failed') throw new Error(outcome.message)
    if (outcome.type === 'draft.clarification.requested') {
      setAiDraftClarificationQuestion(outcome.question)
      setAiDraftStatus('needs-input')
      return
    }
    setAiDraftResult(outcome.draft)
    setAiDraftStatus('completed')
  }

  const draftFromPrompt = async (nextClarifications = clarifications) => {
    const prompt = aiDraftPrompt.trim()
    if (!prompt || !selectedAiDraftProvider || !selectedAiDraftModel) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    setAiDraftStatus('running')
    setAiDraftError(null)
    setAiDraftResult(null)
    setAiDraftClarificationQuestion(null)
    setAiDraftClarificationAnswer('')
    setAiDraftLog([])
    try {
      await consumeDraftStream(
        {
          prompt,
          providerId: selectedAiDraftProvider.id,
          modelId: selectedAiDraftModel.id,
          clarifications: nextClarifications
        },
        controller.signal
      )
    } catch (error) {
      if (controller.signal.aborted) return
      setAiDraftStatus('failed')
      setAiDraftError(error instanceof Error ? error.message : 'Draft generation failed.')
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setBusy(false)
      }
    }
  }

  const submitClarification = async () => {
    if (!aiDraftClarificationQuestion) return
    const answer = aiDraftClarificationAnswer.trim()
    if (!answer) return
    const nextClarifications = [...clarifications, { question: aiDraftClarificationQuestion, answer }]
    setClarifications(nextClarifications)
    await draftFromPrompt(nextClarifications)
  }

  const applyDraft = () => {
    if (!aiDraftResult) return
    const nextForm = definitionToForm(aiDraftResult.definition, workflowId)
    commitEditorChange(() => ({
      form: nextForm,
      yamlOpen: true,
      yamlDraft: aiDraftResult.yaml
    }))
    setYamlValid(true)
    setYamlError(null)
    setAiDraftOpenState(false)
    setAiDraftPrompt('')
    resetDraftState()
  }

  return {
    aiDraftClarificationAnswer,
    aiDraftClarificationQuestion,
    aiDraftLog,
    aiDraftError,
    aiDraftOpen,
    aiDraftPrompt,
    aiDraftResult,
    aiDraftStatus,
    aiModelCatalog,
    applyDraft,
    canDraftFromPrompt,
    catalogStatus,
    cancelDraft,
    draftFromPrompt,
    selectedAiDraftModel,
    selectedAiDraftProvider,
    setAiDraftClarificationAnswer,
    setAiDraftModelId: (modelId: string) => {
      if (modelId !== selectedAiDraftModel?.id) resetDraftState()
      setAiDraftModelId(modelId)
    },
    setAiDraftOpen,
    setAiDraftPrompt: (prompt: string) => {
      if (aiDraftStatus !== 'idle') resetDraftState()
      setAiDraftPrompt(prompt)
    },
    setAiDraftProviderId: (providerId: string) => {
      if (providerId !== selectedAiDraftProvider?.id) resetDraftState()
      setAiDraftProviderId(providerId)
    },
    submitClarification
  }
}
