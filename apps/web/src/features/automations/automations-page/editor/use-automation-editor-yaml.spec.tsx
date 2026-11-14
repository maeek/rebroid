import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { validateAutomationYamlAction } from '@/server/orchestrator/automations/automation-management-actions'
import { buildYaml, definitionToForm } from './builder-utils'
import { useAutomationEditorHistory } from './use-automation-editor-history'
import { useAutomationEditorYaml } from './use-automation-editor-yaml'
import type { AutomationDefinition } from '@rebroid/automation-core/definition'

vi.mock('@/server/orchestrator/automations/automation-management-actions', () => ({
  validateAutomationYamlAction: vi.fn()
}))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))

afterEach(() => {
  vi.useRealTimers()
})

it('keeps the latest AI settings when returning to Visual before YAML validation finishes', async () => {
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
    .mockResolvedValueOnce({ valid: true, definition: edited, errors: [], yaml: buildYaml(definitionToForm(edited)) })
  const { result } = renderHook(() => {
    const history = useAutomationEditorHistory(form)
    return { ...history, ...useAutomationEditorYaml({ ...history, currentYaml: history.visualYaml }) }
  })
  act(() => result.current.toggleYamlEditor())
  await act(async () => vi.advanceTimersByTimeAsync(450))
  expect(result.current.yamlValid).toBe(true)

  expect(result.current.form).toBe(form)

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
