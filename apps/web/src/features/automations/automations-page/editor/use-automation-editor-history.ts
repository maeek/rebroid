import { useCallback, useMemo, useReducer } from 'react'
import { buildYaml, type AutomationFormState } from './builder-utils'

export type EditorSnapshot = {
  form: AutomationFormState
  yamlOpen: boolean
  yamlDraft: string
}

type EditorUpdate = (snapshot: EditorSnapshot) => EditorSnapshot

type EditorHistory = {
  undo: EditorSnapshot[]
  current: EditorSnapshot
  redo: EditorSnapshot[]
  saved: EditorSnapshot
}

type HistoryAction =
  | { type: 'commit' | 'view'; update: EditorUpdate }
  | { type: 'saved'; snapshot: EditorSnapshot }
  | { type: 'undo' | 'redo' | 'discard' }

const maxEditorHistoryEntries = 100

const sameSnapshot = (left: EditorSnapshot, right: EditorSnapshot) =>
  left.yamlOpen === right.yamlOpen &&
  left.yamlDraft === right.yamlDraft &&
  (left.form === right.form || JSON.stringify(left.form) === JSON.stringify(right.form))

const appendUndo = (entries: EditorSnapshot[], snapshot: EditorSnapshot) =>
  [...entries, snapshot].slice(-maxEditorHistoryEntries)

const initializeHistory = (form: AutomationFormState): EditorHistory => {
  const snapshot = { form, yamlOpen: false, yamlDraft: '' }
  return { current: snapshot, saved: snapshot, undo: [], redo: [] }
}

const updateHistory = (history: EditorHistory, action: HistoryAction): EditorHistory => {
  switch (action.type) {
    case 'commit':
    case 'view': {
      const next = action.update(history.current)
      if (sameSnapshot(history.current, next)) return history
      if (action.type === 'view') return { ...history, current: next }
      return { ...history, current: next, undo: appendUndo(history.undo, history.current), redo: [] }
    }
    case 'saved':
      return { ...history, current: action.snapshot, saved: action.snapshot }
    case 'discard':
      return { ...history, current: history.saved, undo: [], redo: [] }
    case 'undo': {
      const previous = history.undo.at(-1)
      if (!previous) return history
      return {
        ...history,
        current: previous,
        undo: history.undo.slice(0, -1),
        redo: [history.current, ...history.redo].slice(0, maxEditorHistoryEntries)
      }
    }
    case 'redo': {
      const next = history.redo[0]
      if (!next) return history
      return { ...history, current: next, undo: appendUndo(history.undo, history.current), redo: history.redo.slice(1) }
    }
  }
}

const serializeVisualDraft = (form: AutomationFormState) => {
  try {
    return buildYaml(form)
  } catch {
    return null
  }
}

export const useAutomationEditorHistory = (initialForm: AutomationFormState) => {
  const [history, dispatch] = useReducer(updateHistory, initialForm, initializeHistory)
  const { current, saved } = history
  const visualYaml = useMemo(() => serializeVisualDraft(current.form), [current.form])
  const savedVisualYaml = useMemo(() => serializeVisualDraft(saved.form), [saved.form])
  const sameVisualDraft =
    visualYaml !== null && savedVisualYaml !== null
      ? visualYaml === savedVisualYaml
      : JSON.stringify(current.form) === JSON.stringify(saved.form)
  const hasUnsavedChanges = current.yamlOpen
    ? current.yamlDraft !== savedVisualYaml && (!saved.yamlOpen || current.yamlDraft !== saved.yamlDraft)
    : !sameVisualDraft

  const commitEditorChange = useCallback((update: EditorUpdate) => dispatch({ type: 'commit', update }), [])
  const changeEditorView = useCallback((update: EditorUpdate) => dispatch({ type: 'view', update }), [])
  const markEditorSaved = useCallback((snapshot: EditorSnapshot) => dispatch({ type: 'saved', snapshot }), [])
  const discardChanges = useCallback(() => dispatch({ type: 'discard' }), [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])

  return {
    ...current,
    visualYaml,
    savedForm: saved.form,
    canRedo: history.redo.length > 0,
    canUndo: history.undo.length > 0,
    hasUnsavedChanges,
    commitEditorChange,
    changeEditorView,
    markEditorSaved,
    discardChanges,
    undo,
    redo
  }
}

export const handleEditorHistoryShortcut = (
  event: KeyboardEvent,
  {
    canUndo,
    canRedo,
    undo,
    redo
  }: Pick<ReturnType<typeof useAutomationEditorHistory>, 'canUndo' | 'canRedo' | 'undo' | 'redo'>
) => {
  if (event.defaultPrevented || event.isComposing || event.altKey || !(event.metaKey || event.ctrlKey)) return
  if (event.target instanceof HTMLElement) {
    if (event.target.isContentEditable || event.target.closest('[role="dialog"], textarea, select, .monaco-editor'))
      return
    if (event.target instanceof HTMLInputElement && !['checkbox', 'radio', 'button'].includes(event.target.type)) return
  }
  const key = event.key.toLowerCase()
  if ((key === 'z' && event.shiftKey) || (key === 'y' && event.ctrlKey && !event.metaKey && !event.shiftKey)) {
    if (!canRedo) return
    event.preventDefault()
    redo()
  } else if (key === 'z' && canUndo) {
    event.preventDefault()
    undo()
  }
}
