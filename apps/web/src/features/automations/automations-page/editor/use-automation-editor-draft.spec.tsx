import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { validateAutomationYamlAction } from '@/server/orchestrator/automations/automation-management-actions'
import { buildYaml, definitionToForm } from './builder-utils'
import { useAutomationEditorDraft } from './use-automation-editor-draft'
import { useAutomationEditorHistory } from './use-automation-editor-history'
import type { AutomationDefinition } from '@rebroid/automation-core/definition'

vi.mock('@/server/orchestrator/automations/automation-management-actions', () => ({
  validateAutomationYamlAction: vi.fn()
}))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))

afterEach(() => {
  vi.resetAllMocks()
  vi.useRealTimers()
})

it('opens serializable Visual drafts with broken references and returns immediately when YAML is unchanged', () => {
  vi.useFakeTimers()
  const form = definitionToForm({
    apiVersion: 'rebroid.io/automation/v1',
    kind: 'AndroidAutomation',
    metadata: { name: 'Repair workflow' },
    spec: { steps: [{ id: 'log', uses: 'debug.log', with: { message: { $ref: 'steps.missing.output.message' } } }] }
  })
  const { result } = renderHook(() => {
    const history = useAutomationEditorHistory(form)
    return { ...history, ...useAutomationEditorDraft({ ...history, hasBrokenReferences: true }) }
  })

  expect(result.current.yamlForSaveOrExport).toBeNull()
  act(() => result.current.toggleYamlEditor())
  expect(result.current.yamlOpen).toBe(true)
  expect(result.current.yamlDraft).toBe(buildYaml(form))
  expect(result.current.yamlPending).toBe(true)
  act(() => result.current.toggleYamlEditor())
  expect(result.current.yamlOpen).toBe(false)
  expect(result.current.form).toBe(form)
  expect(result.current.canUndo).toBe(false)
  expect(validateAutomationYamlAction).not.toHaveBeenCalled()
})

it('applies validated YAML to Visual and keeps AI settings and edit history', async () => {
  vi.useFakeTimers()
  const definition: AutomationDefinition = {
    apiVersion: 'rebroid.io/automation/v1',
    kind: 'AndroidAutomation',
    metadata: { name: 'Find Żappka' },
    spec: { steps: [{ id: 'agent', uses: 'ai.run', with: { prompt: 'Find Żappka', agentMode: 'adaptive' } }] }
  }
  const edited: AutomationDefinition = {
    ...definition,
    spec: {
      steps: [
        {
          id: 'agent',
          uses: 'ai.run',
          with: {
            prompt: 'Find Żappka',
            agentMode: 'planned',
            rawShellPolicy: 'allowlisted',
            conversation: [{ role: 'user', content: 'Use the app drawer' }]
          }
        }
      ]
    }
  }
  const form = definitionToForm(definition)
  form.steps[0].clientKey = 'existing-client-key'
  vi.mocked(validateAutomationYamlAction)
    .mockResolvedValueOnce({ valid: true, definition, errors: [], yaml: buildYaml(form) })
    .mockResolvedValueOnce({ valid: false, errors: ['Invalid YAML'], definition: null, yaml: null })
    .mockResolvedValueOnce({ valid: true, definition: edited, errors: [], yaml: buildYaml(definitionToForm(edited)) })
  const { result } = renderHook(() => {
    const history = useAutomationEditorHistory(form)
    return { ...history, ...useAutomationEditorDraft({ ...history, hasBrokenReferences: false }) }
  })
  act(() => result.current.toggleYamlEditor())
  await act(async () => vi.advanceTimersByTimeAsync(450))
  expect(result.current.yamlForSaveOrExport).toBe(buildYaml(form))

  expect(result.current.form).toBe(form)

  act(() => result.current.commitEditorChange(snapshot => ({ ...snapshot, yamlDraft: '[' })))
  await act(async () => vi.advanceTimersByTimeAsync(450))
  act(() => result.current.toggleYamlEditor())
  expect(result.current.yamlOpen).toBe(true)
  expect(result.current.yamlError).toBe('Invalid YAML')
  expect(result.current.yamlDraft).toBe('[')
  expect(result.current.form).toBe(form)
  act(() => result.current.undo())

  const editedYaml = buildYaml(definitionToForm(edited))
  act(() => result.current.commitEditorChange(snapshot => ({ ...snapshot, yamlDraft: editedYaml })))
  act(() => result.current.toggleYamlEditor())
  expect(result.current.yamlOpen).toBe(true)
  expect(result.current.yamlPending).toBe(true)
  await act(async () => vi.advanceTimersByTimeAsync(450))
  act(() => result.current.toggleYamlEditor())
  expect(result.current.yamlOpen).toBe(false)
  expect(result.current.form).toEqual(definitionToForm(edited, null, form.steps))
  act(() => result.current.undo())
  expect(result.current.yamlDraft).toBe(buildYaml(form))
  act(() => result.current.redo())
  expect(result.current.form).toEqual(definitionToForm(edited, null, form.steps))
})
