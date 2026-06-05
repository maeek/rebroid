import { describe, expect, it } from '@jest/globals'
import { defaultForm } from './builder-utils'
import { cloneAutomationForm, pushUndoSnapshot, sameEditorSnapshot } from './use-automation-editor-history'

describe('automation editor history helpers', () => {
  it('compares snapshots by form and yaml state', () => {
    const form = defaultForm()
    const snapshot = { form, yamlOpen: false, yamlDraft: '' }

    expect(sameEditorSnapshot(snapshot, { form: cloneAutomationForm(form), yamlOpen: false, yamlDraft: '' })).toBe(true)
    expect(sameEditorSnapshot(snapshot, { form, yamlOpen: true, yamlDraft: '' })).toBe(false)
  })

  it('pushes unique undo snapshots and clears redo', () => {
    const first = { form: defaultForm(), yamlOpen: false, yamlDraft: '' }
    const second = { form: { ...defaultForm(), name: 'Updated' }, yamlOpen: false, yamlDraft: '' }

    const withFirst = pushUndoSnapshot({ undo: [], redo: [second] }, first)
    const duplicate = pushUndoSnapshot(withFirst, first)
    const withSecond = pushUndoSnapshot(duplicate, second)

    expect(withFirst.redo).toEqual([])
    expect(duplicate.undo).toHaveLength(1)
    expect(withSecond.undo.map(snapshot => snapshot.form.name)).toEqual(['New workflow', 'Updated'])
  })
})
