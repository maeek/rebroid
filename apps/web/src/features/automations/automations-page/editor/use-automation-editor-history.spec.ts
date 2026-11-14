import { StrictMode, createElement } from 'react'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { defaultForm } from './builder-utils'
import { useAutomationEditorHistory } from './use-automation-editor-history'

describe('workflow editor history', () => {
  it('undoes and redoes a committed change as one entry under Strict Mode', () => {
    const { result } = renderHook(() => useAutomationEditorHistory(defaultForm()), {
      wrapper: ({ children }) => createElement(StrictMode, null, children)
    })
    const first = result.current.form.name

    act(() =>
      result.current.commitEditorChange(snapshot => ({ ...snapshot, form: { ...snapshot.form, name: 'Edited' } }))
    )
    expect(result.current.hasUnsavedChanges).toBe(true)

    act(() => result.current.undo())
    expect(result.current.form.name).toBe(first)
    expect(result.current.canUndo).toBe(false)
    expect(result.current.hasUnsavedChanges).toBe(false)

    act(() => result.current.redo())
    expect(result.current.form.name).toBe('Edited')
    expect(result.current.canRedo).toBe(false)
  })

  it('preserves redo across a no-op and mode switch, and clears it after a new edit', () => {
    const { result } = renderHook(() => useAutomationEditorHistory(defaultForm()))
    const yaml = result.current.visualYaml!

    act(() => {
      result.current.commitEditorChange(snapshot => ({
        ...snapshot,
        form: { ...snapshot.form, description: 'Changed' }
      }))
      result.current.undo()
      result.current.commitEditorChange(snapshot => ({ ...snapshot }))
      result.current.changeEditorView(snapshot => ({ ...snapshot, yamlOpen: true, yamlDraft: yaml }))
    })
    expect(result.current.canRedo).toBe(true)
    expect(result.current.canUndo).toBe(false)
    expect(result.current.hasUnsavedChanges).toBe(false)

    act(() => result.current.commitEditorChange(snapshot => ({ ...snapshot, yamlDraft: '# Draft\n' + yaml })))
    expect(result.current.canRedo).toBe(false)
    expect(result.current.hasUnsavedChanges).toBe(true)
  })

  it('uses the last successful save as the baseline independently of undo availability', () => {
    const { result } = renderHook(() => useAutomationEditorHistory(defaultForm()))
    const changeName = (name: string) =>
      result.current.commitEditorChange(snapshot => ({ ...snapshot, form: { ...snapshot.form, name } }))

    act(() => changeName('Saved'))
    act(() => result.current.markEditorSaved({ form: result.current.form, yamlOpen: false, yamlDraft: '' }))
    expect(result.current.canUndo).toBe(true)
    expect(result.current.hasUnsavedChanges).toBe(false)

    act(() => result.current.undo())
    expect(result.current.hasUnsavedChanges).toBe(true)
    act(() => result.current.redo())
    expect(result.current.hasUnsavedChanges).toBe(false)

    act(() => {
      changeName('Another draft')
      changeName('Saved')
    })
    expect(result.current.hasUnsavedChanges).toBe(false)
  })
})
