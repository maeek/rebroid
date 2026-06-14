'use client'

import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { toast } from '@/hooks/use-toast'
import { definitionToForm } from './builder-utils'
import { useAiDraftModelSelection } from './use-ai-draft-model-selection'
import type {
  AutomationYamlDraft,
  AutomationYamlDraftStreamEvent,
  DraftAutomationYamlInput
} from '@/server/orchestrator/automations/types'
import type { EditorSnapshot } from './use-automation-editor-history'

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

const parseDraftStreamEvent = (event: string): AutomationYamlDraftStreamEvent | null => {
  const data = event
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice('data:'.length).trimStart())
    .join('\n')
  if (!data) return null
  try {
    const parsed = JSON.parse(data) as unknown
    return parsed && typeof parsed === 'object' && 'type' in parsed ? (parsed as AutomationYamlDraftStreamEvent) : null
  } catch {
    return null
  }
}

const responseErrorMessage = async (response: Response) => {
  const error = (await response.json().catch(() => null)) as { message?: unknown } | null
  return typeof error?.message === 'string' ? error.message : response.statusText || 'Draft request failed.'
}

export const useAutomationAiDraft = ({
  commitEditorChange,
  setBusy,
  setYamlError,
  setYamlValid,
  workflowId
}: {
  commitEditorChange: (update: () => EditorSnapshot) => void
  setBusy: Dispatch<SetStateAction<boolean>>
  setYamlError: Dispatch<SetStateAction<string | null>>
  setYamlValid: Dispatch<SetStateAction<boolean>>
  workflowId: string | null
}) => {
  const [aiDraftOpen, setAiDraftOpenState] = useState(false)
  const [aiDraftPrompt, setAiDraftPrompt] = useState('')
  const [aiDraftStatus, setAiDraftStatus] = useState<AiDraftStatus>('idle')
  const [aiDraftLog, setAiDraftLog] = useState<AiDraftLogItem[]>([])
  const [aiDraftResult, setAiDraftResult] = useState<AutomationYamlDraft | null>(null)
  const [aiDraftClarificationQuestion, setAiDraftClarificationQuestion] = useState<string | null>(null)
  const [aiDraftClarificationAnswer, setAiDraftClarificationAnswer] = useState('')
  const [clarifications, setClarifications] = useState<Array<{ question: string; answer: string }>>([])
  const abortRef = useRef<AbortController | null>(null)
  const {
    canDraftFromPrompt,
    catalog: aiModelCatalog,
    model: selectedAiDraftModel,
    provider: selectedAiDraftProvider,
    setModelId: setAiDraftModelId,
    setProviderId: setAiDraftProviderId
  } = useAiDraftModelSelection()

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
    if (!response.body) throw new Error('Draft stream did not return a response body.')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      while (true) {
        const { done, value } = await reader.read()
        buffer += decoder.decode(value, { stream: !done })
        const events = buffer.split(/\r?\n\r?\n/)
        buffer = events.pop() ?? ''
        for (const rawEvent of events) {
          const event = parseDraftStreamEvent(rawEvent)
          if (!event) continue
          appendLog(event.type, event.message)
          if (event.type === 'draft.completed') {
            setAiDraftResult(event.data)
            setAiDraftStatus('completed')
            return
          }
          if (event.type === 'draft.clarification.requested') {
            setAiDraftClarificationQuestion(event.data.question)
            setAiDraftStatus('needs-input')
            return
          }
          if (event.type === 'draft.failed') {
            setAiDraftStatus('failed')
            throw new Error(event.message)
          }
        }
        if (done) break
      }
    } finally {
      reader.releaseLock()
    }
    throw new Error('AI draft stream ended without a completed draft.')
  }

  const draftFromPrompt = async (nextClarifications = clarifications) => {
    const prompt = aiDraftPrompt.trim()
    if (!prompt || !selectedAiDraftProvider || !selectedAiDraftModel) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    setAiDraftStatus('running')
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
      toast({
        title: 'Could not draft automation',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setBusy(false)
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
    aiDraftOpen,
    aiDraftPrompt,
    aiDraftResult,
    aiDraftStatus,
    aiModelCatalog,
    applyDraft,
    canDraftFromPrompt,
    cancelDraft,
    draftFromPrompt,
    selectedAiDraftModel,
    selectedAiDraftProvider,
    setAiDraftClarificationAnswer,
    setAiDraftModelId,
    setAiDraftOpen,
    setAiDraftPrompt,
    setAiDraftProviderId,
    submitClarification
  }
}
