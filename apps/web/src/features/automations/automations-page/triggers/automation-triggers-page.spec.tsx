import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAutomationTriggerAction,
  deleteAutomationTriggerAction,
  updateAutomationTriggerAction
} from '@/server/orchestrator/automations/automation-trigger-actions'
import { applicationPreview } from '@/shared/testing/application-preview'
import { AutomationTriggersPage } from './automation-triggers-page'
import { AutomationTriggersPreview, previewTrigger } from './automation-triggers-preview'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
vi.mock('@/server/orchestrator/automations/automation-trigger-actions', () => ({
  createAutomationTriggerAction: vi.fn(),
  deleteAutomationTriggerAction: vi.fn(),
  updateAutomationTriggerAction: vi.fn(),
  runAutomationTriggerAction: vi.fn()
}))
beforeEach(() => {
  vi.resetAllMocks()
})

describe('Triggers editor workflow', () => {
  it('saves the selected app, profile, schedule, and start policy with the existing contract', async () => {
    vi.mocked(createAutomationTriggerAction).mockResolvedValue(previewTrigger)
    render(<AutomationTriggersPreview />)
    fireEvent.click(screen.getByRole('button', { name: 'New trigger' }))
    const dialog = await screen.findByRole('dialog', { name: 'New trigger' })
    expect(within(dialog).getByRole('combobox', { name: /Workflow/ })).toHaveValue('Daily inventory check')
    expect(within(dialog).getByRole('combobox', { name: 'Profile' })).toBeVisible()
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Name/ }), { target: { value: 'Nightly check' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Description' }), {
      target: { value: '  Check stock overnight.  ' }
    })
    fireEvent.click(within(dialog).getByRole('switch', { name: 'Start app if needed' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create trigger' }))
    await waitFor(() =>
      expect(createAutomationTriggerAction).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          name: 'Nightly check',
          description: 'Check stock overnight.',
          targetApplicationId: applicationPreview.id,
          profileMode: 'persistent',
          profileName: 'default',
          enabled: true,
          triggerType: 'schedule',
          triggerConfig: { cronExpression: '0 3 * * *', startPolicy: 'require-running' }
        })
      )
    )
  })

  it('searches workflow context and app identifiers, reuses tags, and creates new tags explicitly', async () => {
    vi.mocked(createAutomationTriggerAction).mockResolvedValue(previewTrigger)
    render(<AutomationTriggersPreview />)
    fireEvent.click(screen.getByRole('button', { name: 'New trigger' }))
    const dialog = await screen.findByRole('dialog', { name: 'New trigger' })
    const workflow = within(dialog).getByRole('combobox', { name: /Workflow/ })
    fireEvent.click(workflow)
    fireEvent.input(workflow, { target: { value: 'warehouse' } })
    fireEvent.click(await screen.findByRole('option', { name: /Reconcile warehouse/ }))
    expect(within(dialog).getByText(/Reconcile warehouse inventory/)).toBeVisible()

    const app = within(dialog).getByRole('combobox', { name: /Target app/ })
    fireEvent.click(app)
    fireEvent.input(app, { target: { value: 'reports-app' } })
    fireEvent.click(await screen.findByRole('option', { name: /Reports worker/ }))
    expect(app).toHaveValue('Reports worker')

    const tags = within(dialog).getByRole('combobox', { name: 'Tags' })
    fireEvent.click(tags)
    fireEvent.input(tags, { target: { value: 'smoke' } })
    expect(screen.queryByRole('option', { name: /Create/ })).toBeNull()
    fireEvent.click(await screen.findByRole('option', { name: 'smoke' }))
    expect(within(dialog).getByRole('button', { name: 'Remove smoke' })).toBeVisible()
    fireEvent.click(tags)
    fireEvent.input(tags, { target: { value: 'Release QA' } })
    fireEvent.click(await screen.findByRole('option', { name: 'Create “Release QA”' }))
    expect(await within(dialog).findByRole('button', { name: 'Remove Release QA' })).toBeVisible()
    expect(createAutomationTriggerAction).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('textbox', { name: /Name/ }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create trigger' }))
    await waitFor(() =>
      expect(createAutomationTriggerAction).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          automationId: 'warehouse-workflow',
          targetApplicationId: 'reports-app',
          tags: [
            { name: 'smoke', color: '#64748b' },
            { name: 'Release QA', color: '#64748b' }
          ]
        })
      )
    )
  })

  it('loads a saved description when editing', async () => {
    vi.mocked(updateAutomationTriggerAction).mockResolvedValue(previewTrigger)
    render(<AutomationTriggersPreview />)
    fireEvent.click(screen.getByRole('button', { name: 'Morning inventory' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit trigger' })
    const description = within(dialog).getByRole('textbox', { name: 'Description' })
    expect(description).toHaveValue(previewTrigger.description)
    fireEvent.change(description, { target: { value: '' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(updateAutomationTriggerAction).toHaveBeenCalledWith(
        previewTrigger.id,
        expect.objectContaining({ description: null })
      )
    )
  })

  it('blocks saving a trigger whose workflow is no longer available', async () => {
    render(
      <AutomationTriggersPage
        initialApplications={[applicationPreview]}
        initialAutomations={[]}
        triggersPage={{
          items: [previewTrigger],
          total: 1,
          page: 1,
          pageSize: 20,
          facets: { tags: [], targetApplicationIds: [] }
        }}
        gridQuery={{}}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Morning inventory' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit trigger' })
    expect(within(dialog).getByRole('combobox', { name: /Workflow/ })).toHaveAccessibleDescription(
      /no longer available/
    )
    expect(within(dialog).getByRole('button', { name: 'Save changes' })).toBeDisabled()
    expect(createAutomationTriggerAction).not.toHaveBeenCalled()
    expect(updateAutomationTriggerAction).not.toHaveBeenCalled()
  })

  it('locks the editor while saving and keeps its draft after failure', async () => {
    let fail!: (error: Error) => void
    vi.mocked(createAutomationTriggerAction).mockImplementation(
      () =>
        new Promise((_, reject) => {
          fail = reject
        })
    )
    render(<AutomationTriggersPreview />)
    fireEvent.click(screen.getByRole('button', { name: 'New trigger' }))
    const dialog = await screen.findByRole('dialog', { name: 'New trigger' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create trigger' }))
    expect(within(dialog).getByRole('button', { name: 'Creating…' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(within(dialog).getByRole('combobox', { name: /Target app/ })).toBeDisabled()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(dialog).toBeVisible()
    await act(async () => {
      fail(new Error('Unavailable'))
      await Promise.resolve()
    })
    expect(within(dialog).getByRole('textbox', { name: /Name/ })).toHaveValue(
      'Daily inventory check on Inventory worker'
    )
    expect(within(dialog).getByRole('button', { name: 'Create trigger' })).toBeEnabled()
  })

  it('keeps bulk enable/disable actions pending until the operation finishes', async () => {
    let finish!: () => void
    vi.mocked(updateAutomationTriggerAction).mockImplementation(
      () =>
        new Promise(resolve => {
          finish = () => resolve(previewTrigger)
        })
    )
    render(<AutomationTriggersPreview />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select current page' }))
    fireEvent.click(screen.getByRole('button', { name: 'Disable' }))
    expect(screen.getByRole('button', { name: 'Disabling…' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Select current page' })).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select current page' }))
    expect(screen.getByRole('checkbox', { name: 'Select current page' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
    expect(updateAutomationTriggerAction).toHaveBeenCalledExactlyOnceWith(previewTrigger.id, { enabled: false })
    await act(async () => {
      finish()
      await Promise.resolve()
    })
    expect(screen.getByRole('button', { name: 'Disable' })).toBeEnabled()
  })

  it('confirms bulk deletion and prevents closing or repeating a pending request', async () => {
    let finish!: () => void
    vi.mocked(deleteAutomationTriggerAction).mockImplementation(
      () =>
        new Promise(resolve => {
          finish = () => resolve(previewTrigger)
        })
    )
    render(<AutomationTriggersPreview />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select current page' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete 1 selected triggers?' })
    expect(deleteAutomationTriggerAction).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete triggers' }))
    expect(within(dialog).getByRole('button', { name: 'Deleting…' })).toBeDisabled()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(dialog).toBeVisible()
    expect(deleteAutomationTriggerAction).toHaveBeenCalledExactlyOnceWith(previewTrigger.id)
    await act(async () => {
      finish()
      await Promise.resolve()
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
