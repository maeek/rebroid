const pendingAutomationDraftStorageKey = 'rebroid.automation-draft'

export type PendingAutomationDraft = {
  yaml: string
  ownerUserId: string
  sourceRunId: string
}

export const storePendingAutomationDraft = (draft: PendingAutomationDraft) => {
  window.sessionStorage.setItem(pendingAutomationDraftStorageKey, JSON.stringify(draft))
}

export const readPendingAutomationDraft = (ownerUserId: string): PendingAutomationDraft | null => {
  try {
    const raw = window.sessionStorage.getItem(pendingAutomationDraftStorageKey)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return null
    }
    const record = parsed as Record<string, unknown>
    if (
      record.ownerUserId !== ownerUserId ||
      typeof record.sourceRunId !== 'string' ||
      typeof record.yaml !== 'string' ||
      record.yaml.trim().length === 0
    ) {
      return null
    }
    return { yaml: record.yaml, ownerUserId, sourceRunId: record.sourceRunId }
  } catch {
    return null
  }
}

export const clearPendingAutomationDraft = (draft: PendingAutomationDraft) => {
  const current = readPendingAutomationDraft(draft.ownerUserId)
  if (current?.yaml !== draft.yaml || current.sourceRunId !== draft.sourceRunId) return

  try {
    window.sessionStorage.removeItem(pendingAutomationDraftStorageKey)
  } catch {
    // The editor still owns the draft if browser storage has become unavailable.
  }
}
