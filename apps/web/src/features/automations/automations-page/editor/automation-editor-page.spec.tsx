import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  createAutomationAction,
  updateAutomationAction,
  validateAutomationYamlAction
} from '@/server/orchestrator/automations/automation-management-actions'
import { FeatureFlagsProvider } from '@/shared/model/features/feature-flags-context'
import { AutomationEditorPage } from './automation-editor-page'
import { buildYaml, defaultStep, definitionToForm, type AutomationStepForm } from './builder-utils'
import type { Automation } from '@/shared/contracts/automation'
import type { AutomationDefinition } from '@rebroid/automation-core/definition'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
vi.mock('@/server/orchestrator/automations/automation-management-actions', () => ({
  createAutomationAction: vi.fn(),
  updateAutomationAction: vi.fn(),
  validateAutomationYamlAction: vi.fn()
}))
vi.mock('../steps/list/automation-steps-list', () => ({
  AutomationStepsList: ({ onChange }: { onChange: (steps: AutomationStepForm[]) => void }) => (
    <button
      type='button'
      onClick={() => onChange([{ ...defaultStep('debug.log'), withJson: '{' }])}
    >
      Set invalid step input
    </button>
  )
}))
vi.mock('./automation-yaml-editor-section', () => ({
  AutomationYamlEditorSection: ({
    yaml,
    onYamlChange,
    error
  }: {
    yaml: string
    onYamlChange: (text: string) => void
    error: string | null
  }) => (
    <>
      <textarea
        aria-label='Workflow YAML'
        value={yaml}
        onChange={event => onYamlChange(event.target.value)}
      />
      {error && <p role='alert'>{error}</p>}
    </>
  )
}))

const definition: AutomationDefinition = {
  apiVersion: 'rebroid.io/automation/v1',
  kind: 'AndroidAutomation',
  metadata: { name: 'Saved workflow' },
  spec: { steps: [{ id: 'start', uses: 'debug.log', with: { message: 'Start' } }] }
}
const savedYaml = buildYaml(definitionToForm(definition))
const savedWorkflow = {
  id: 'workflow-1',
  name: definition.metadata.name,
  description: null,
  tags: [],
  ownerUserId: 'owner-1',
  lastRunAt: null,
  lastStatus: 'never_run',
  lastError: null,
  yaml: savedYaml,
  definition,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
} satisfies Automation

const renderEditor = (initialAutomation?: Automation) =>
  render(
    <FeatureFlagsProvider manifest={null}>
      <AutomationEditorPage
        initialAutomation={initialAutomation}
        initialCommands={[]}
        canUseAi={false}
        canManageAi={false}
      />
    </FeatureFlagsProvider>
  )

const saveButton = () => screen.getByRole('button', { name: 'Save' })
const exportItem = () => screen.getByRole('menuitem', { name: 'Export workflow' })
const openActions = () => fireEvent.click(screen.getByRole('button', { name: 'More workflow actions' }))
const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:workflow')

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: () => undefined,
    removeEventListener: () => undefined
  }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = createObjectURL
      static revokeObjectURL = vi.fn()
    }
  )
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

it.each([
  { label: 'new', workflow: undefined },
  { label: 'saved', workflow: savedWorkflow }
])('blocks Save, Export, and opening YAML for an invalid $label visual draft', ({ workflow }) => {
  renderEditor(workflow)
  fireEvent.click(screen.getByRole('button', { name: 'Set invalid step input' }))

  expect(screen.getByText(/Fix invalid step inputs before saving/)).toBeVisible()
  expect(saveButton()).toBeDisabled()
  fireEvent.click(saveButton())
  fireEvent.click(screen.getByRole('button', { name: 'YAML' }))
  expect(screen.queryByRole('textbox', { name: 'Workflow YAML' })).toBeNull()

  openActions()
  expect(exportItem()).toHaveAttribute('aria-disabled', 'true')
  fireEvent.click(exportItem())
  expect(createAutomationAction).not.toHaveBeenCalled()
  expect(updateAutomationAction).not.toHaveBeenCalled()
  expect(createObjectURL).not.toHaveBeenCalled()
})

it('ignores older YAML validation and uses the exact validated draft for Export and Save', async () => {
  vi.useFakeTimers()
  const first = Promise.withResolvers<Awaited<ReturnType<typeof validateAutomationYamlAction>>>()
  const next = Promise.withResolvers<Awaited<ReturnType<typeof validateAutomationYamlAction>>>()
  vi.mocked(validateAutomationYamlAction).mockReturnValueOnce(first.promise).mockReturnValueOnce(next.promise)
  const editedYaml = `${savedYaml.replace('Saved workflow', 'Edited workflow')}\n\n`
  const editedDefinition = { ...definition, metadata: { name: 'Edited workflow' } }
  const editedWorkflow = {
    ...savedWorkflow,
    name: editedDefinition.metadata.name,
    yaml: editedYaml,
    definition: editedDefinition
  }
  vi.mocked(updateAutomationAction).mockResolvedValue(editedWorkflow)
  renderEditor(savedWorkflow)

  fireEvent.click(screen.getByRole('button', { name: 'YAML' }))
  await act(async () => vi.advanceTimersByTimeAsync(450))
  fireEvent.change(screen.getByRole('textbox', { name: 'Workflow YAML' }), { target: { value: editedYaml } })
  await act(async () => vi.advanceTimersByTimeAsync(450))
  await act(async () => {
    first.resolve({ valid: true, errors: [], definition, yaml: savedYaml })
    await first.promise
  })

  expect(saveButton()).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Visual editor' }))
  expect(screen.getByRole('textbox', { name: 'Workflow YAML' })).toHaveValue(editedYaml)
  openActions()
  expect(exportItem()).toHaveAttribute('aria-disabled', 'true')

  await act(async () => {
    next.resolve({ valid: true, errors: [], definition: editedDefinition, yaml: editedYaml.trim() })
    await next.promise
  })
  expect(exportItem()).not.toHaveAttribute('aria-disabled', 'true')
  fireEvent.click(exportItem())
  expect(createObjectURL).toHaveBeenCalledTimes(1)
  const blob = createObjectURL.mock.calls[0][0]
  vi.useRealTimers()
  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Expected YAML text'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Could not read exported YAML'))
    reader.readAsText(blob)
  })
  expect(text).toBe(editedYaml)
  fireEvent.click(saveButton())
  await waitFor(() =>
    expect(updateAutomationAction).toHaveBeenCalledExactlyOnceWith(savedWorkflow.id, { yaml: editedYaml })
  )
})
