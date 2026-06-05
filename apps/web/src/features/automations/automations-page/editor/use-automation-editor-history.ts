import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { AutomationFormState } from './builder-utils'

export type EditorSnapshot = {
  form: AutomationFormState
  yamlOpen: boolean
  yamlDraft: string
}

type EditorHistoryState = {
  undo: EditorSnapshot[]
  redo: EditorSnapshot[]
}

export const maxEditorHistoryEntries = 100

export const cloneAutomationForm = (form: AutomationFormState): AutomationFormState =>
  typeof structuredClone === 'function'
    ? structuredClone(form)
    : (JSON.parse(JSON.stringify(form)) as AutomationFormState)

export const sameEditorSnapshot = (left: EditorSnapshot, right: EditorSnapshot) =>
  left.yamlOpen === right.yamlOpen &&
  left.yamlDraft === right.yamlDraft &&
  JSON.stringify(left.form) === JSON.stringify(right.form)

export const pushUndoSnapshot = (history: EditorHistoryState, snapshot: EditorSnapshot): EditorHistoryState => {
  const previous = history.undo.at(-1)
  if (previous && sameEditorSnapshot(previous, snapshot)) return history
  return {
    undo: [...history.undo, snapshot].slice(-maxEditorHistoryEntries),
    redo: []
  }
}

export const isEditableShortcutTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false
  if (target instanceof HTMLElement && target.isContentEditable) return true
  const editable = target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')
  if (!editable) return false
  if (editable instanceof HTMLInputElement) {
    return editable.type !== 'checkbox' && editable.type !== 'radio'
  }
  return true
}

export const useAutomationEditorHistory = ({
  form,
  yamlOpen,
  yamlDraft,
  setForm,
  setYamlOpen,
  setYamlDraft
}: {
  form: AutomationFormState
  yamlOpen: boolean
  yamlDraft: string
  setForm: Dispatch<SetStateAction<AutomationFormState>>
  setYamlOpen: Dispatch<SetStateAction<boolean>>
  setYamlDraft: Dispatch<SetStateAction<string>>
}) => {
  const [history, setHistory] = useState<EditorHistoryState>({ undo: [], redo: [] })
  const snapshotRef = useRef<EditorSnapshot | null>(null)
  const canUndo = history.undo.length > 0
  const canRedo = history.redo.length > 0

  const currentSnapshot = useCallback(
    () => ({
      form: cloneAutomationForm(snapshotRef.current?.form ?? form),
      yamlOpen: snapshotRef.current?.yamlOpen ?? yamlOpen,
      yamlDraft: snapshotRef.current?.yamlDraft ?? yamlDraft
    }),
    [form, yamlDraft, yamlOpen]
  )

  const applySnapshot = useCallback(
    (snapshot: EditorSnapshot) => {
      const nextSnapshot = {
        form: cloneAutomationForm(snapshot.form),
        yamlOpen: snapshot.yamlOpen,
        yamlDraft: snapshot.yamlDraft
      }
      snapshotRef.current = nextSnapshot
      setForm(nextSnapshot.form)
      setYamlOpen(nextSnapshot.yamlOpen)
      setYamlDraft(nextSnapshot.yamlDraft)
    },
    [setForm, setYamlDraft, setYamlOpen]
  )

  const recordHistory = useCallback(() => {
    const snapshot = currentSnapshot()
    setHistory(current => pushUndoSnapshot(current, snapshot))
  }, [currentSnapshot])

  const commitEditorChange = useCallback(
    (update: () => EditorSnapshot) => {
      recordHistory()
      applySnapshot(update())
    },
    [applySnapshot, recordHistory]
  )

  const resetEditorHistory = useCallback((snapshot: EditorSnapshot) => {
    snapshotRef.current = {
      form: cloneAutomationForm(snapshot.form),
      yamlOpen: snapshot.yamlOpen,
      yamlDraft: snapshot.yamlDraft
    }
    setHistory({ undo: [], redo: [] })
  }, [])

  const undo = useCallback(() => {
    setHistory(current => {
      const previous = current.undo.at(-1)
      if (!previous) return current
      const currentValue = currentSnapshot()
      applySnapshot(previous)
      return {
        undo: current.undo.slice(0, -1),
        redo: [currentValue, ...current.redo].slice(0, maxEditorHistoryEntries)
      }
    })
  }, [applySnapshot, currentSnapshot])

  const redo = useCallback(() => {
    setHistory(current => {
      const next = current.redo[0]
      if (!next) return current
      const currentValue = currentSnapshot()
      applySnapshot(next)
      return {
        undo: [...current.undo, currentValue].slice(-maxEditorHistoryEntries),
        redo: current.redo.slice(1)
      }
    })
  }, [applySnapshot, currentSnapshot])

  useEffect(() => {
    snapshotRef.current = {
      form: cloneAutomationForm(form),
      yamlOpen,
      yamlDraft
    }
  }, [form, yamlDraft, yamlOpen])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isModZ = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z'
      if (!isModZ || event.altKey || isEditableShortcutTarget(event.target)) return

      if (event.shiftKey) {
        if (!canRedo) return
        event.preventDefault()
        redo()
        return
      }

      if (!canUndo) return
      event.preventDefault()
      undo()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canRedo, canUndo, redo, undo])

  return {
    canRedo,
    canUndo,
    commitEditorChange,
    currentSnapshot,
    hasUnsavedHistory: canUndo,
    resetEditorHistory,
    undo,
    redo
  }
}
