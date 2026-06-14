const pendingAutomationDraftStorageKey = 'rebroid.pending-automation-draft.v1'

export type PendingAutomationDraft = {
  yaml: string
  sourceRunId?: string
}

export const storePendingAutomationDraft = (draft: PendingAutomationDraft) => {
  window.sessionStorage.setItem(pendingAutomationDraftStorageKey, JSON.stringify(draft))
}

export const consumePendingAutomationDraft = (): PendingAutomationDraft | null => {
  const raw = window.sessionStorage.getItem(pendingAutomationDraftStorageKey)
  window.sessionStorage.removeItem(pendingAutomationDraftStorageKey)
  if (!raw) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return null
    }
    const record = parsed as Record<string, unknown>
    if (typeof record.yaml !== 'string' || record.yaml.trim().length === 0) {
      return null
    }
    return {
      yaml: record.yaml,
      ...(typeof record.sourceRunId === 'string' ? { sourceRunId: record.sourceRunId } : {})
    }
  } catch {
    return null
  }
}
