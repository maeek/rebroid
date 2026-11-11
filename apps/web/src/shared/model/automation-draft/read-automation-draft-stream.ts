import { AUTOMATION_API_VERSION, AUTOMATION_KIND } from '@rebroid/automation-core/definition'
import type { AutomationYamlDraft, AutomationYamlDraftStreamEvent } from '@rebroid/automation-core/yaml-draft'

type DraftProgress = Pick<AutomationYamlDraftStreamEvent, 'type' | 'message'>
type DraftOutcome =
  | { type: 'draft.completed'; draft: AutomationYamlDraft }
  | { type: 'draft.clarification.requested'; question: string }
  | { type: 'draft.failed'; message: string }

const progressTypes = new Set<string>([
  'draft.started',
  'draft.model.started',
  'draft.phase',
  'draft.message.delta',
  'draft.validation.failed',
  'draft.repair.started'
])

const asRecord = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null

const isDraft = (value: unknown): value is AutomationYamlDraft => {
  const draft = asRecord(value)
  const definition = asRecord(draft?.definition)
  const metadata = asRecord(definition?.metadata)
  const spec = asRecord(definition?.spec)
  // The orchestrator validates the workflow itself before publishing this event.
  return (
    typeof draft?.yaml === 'string' &&
    definition?.apiVersion === AUTOMATION_API_VERSION &&
    definition.kind === AUTOMATION_KIND &&
    typeof metadata?.name === 'string' &&
    Array.isArray(spec?.steps)
  )
}

const readFrame = (frame: string, onEvent?: (event: DraftProgress) => void): DraftOutcome | undefined => {
  const data = frame
    .split(/\r\n|\r|\n/)
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).replace(/^ /, ''))
    .join('\n')
  if (!data) return
  let event: Record<string, unknown> | null
  try {
    event = asRecord(JSON.parse(data))
  } catch {
    return
  }
  if (typeof event?.type !== 'string' || typeof event.message !== 'string') return
  const { type, message } = event
  if (type === 'draft.completed') {
    if (!isDraft(event.data)) throw new Error('AI draft stream returned an invalid draft.')
    onEvent?.({ type, message })
    return { type, draft: event.data }
  }
  if (type === 'draft.clarification.requested') {
    const question = asRecord(event.data)?.question
    if (typeof question !== 'string' || !question.trim()) {
      throw new Error('AI draft stream returned an invalid clarification.')
    }
    onEvent?.({ type, message })
    return { type, question }
  }
  if (type === 'draft.failed') {
    onEvent?.({ type, message })
    return { type, message }
  }
  if (progressTypes.has(type)) onEvent?.({ type: type as DraftProgress['type'], message })
}

export async function readAutomationDraftStream(
  body: ReadableStream<Uint8Array> | null,
  { onEvent, signal }: { onEvent?: (event: DraftProgress) => void; signal?: AbortSignal } = {}
): Promise<DraftOutcome> {
  if (!body) throw new Error('Draft stream did not return a response body.')
  const reader = body.getReader()
  const decoder = new TextDecoder()
  const cancel = () => void reader.cancel().catch(() => undefined)
  signal?.addEventListener('abort', cancel, { once: true })
  let buffer = ''
  try {
    while (true) {
      signal?.throwIfAborted()
      const { done, value } = await reader.read()
      signal?.throwIfAborted()
      buffer += decoder.decode(value, { stream: !done })
      const frames = buffer.split(/\r\n\r\n|\n\n|\r\r|\r\n\n|\n\r\n/)
      buffer = frames.pop() ?? ''
      for (const frame of frames) {
        const outcome = readFrame(frame, onEvent)
        if (outcome) return outcome
      }
      if (done) throw new Error('AI draft stream ended without a completed draft.')
    }
  } finally {
    signal?.removeEventListener('abort', cancel)
    cancel()
    reader.releaseLock()
  }
}
