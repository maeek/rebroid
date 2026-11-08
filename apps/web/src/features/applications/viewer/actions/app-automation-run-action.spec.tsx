import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { previewApp } from '@/features/applications/detail/app-resource-preview-data'
import { listRunnableAutomationsAction } from '@/server/orchestrator/automations/automation-management-actions'
import { runAutomationAction } from '@/server/orchestrator/automations/automation-run-actions'
import { fullPermissions } from '@/shared/permissions/permissions'
import { previewWorkflow } from '@/shared/testing/automation-preview'
import { AppAutomationRunAction } from './app-automation-run-action'

vi.mock('@/features/applications/detail/application-viewer-context', () => ({
  useApplicationViewerContext: () => ({ app: previewApp, permissions: fullPermissions, setApp: vi.fn() })
}))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
vi.mock('@/server/orchestrator/automations/automation-management-actions', () => ({
  listRunnableAutomationsAction: vi.fn()
}))
vi.mock('@/server/orchestrator/automations/automation-run-actions', () => ({ runAutomationAction: vi.fn() }))
vi.mock('@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions', () => ({
  deleteApplicationProfileAction: vi.fn()
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))

beforeEach(() => {
  vi.resetAllMocks()
})

describe('App run workflow dialog', () => {
  it('uses the same profile and start controls as triggers and preserves the execution payload', async () => {
    vi.mocked(listRunnableAutomationsAction).mockResolvedValue([previewWorkflow])
    let fail!: (error: Error) => void
    vi.mocked(runAutomationAction).mockImplementation(
      () =>
        new Promise((_, reject) => {
          fail = reject
        })
    )
    render(<AppAutomationRunAction />)
    fireEvent.click(screen.getByRole('button', { name: 'Run workflow' }))
    const dialog = await screen.findByRole('dialog', { name: 'Run workflow' })
    await waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Workflow' })).toBeEnabled())
    expect(within(dialog).getByRole('combobox', { name: 'Profile' })).toHaveTextContent('default')
    fireEvent.click(within(dialog).getByRole('switch', { name: 'Start app if needed' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Run workflow' }))
    expect(runAutomationAction).toHaveBeenCalledExactlyOnceWith(previewWorkflow.id, {
      targetApplicationId: previewApp.id,
      profileMode: 'persistent',
      profileName: 'default',
      startPolicy: 'require-running'
    })
    expect(within(dialog).getByRole('button', { name: 'Queuing…' })).toBeDisabled()
    expect(within(dialog).getByRole('combobox', { name: 'Workflow' })).toBeDisabled()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(dialog).toBeVisible()
    await act(async () => {
      fail(new Error('Unavailable'))
      await Promise.resolve()
    })
    expect(within(dialog).getByRole('button', { name: 'Run workflow' })).toBeEnabled()
    expect(within(dialog).getByRole('switch', { name: 'Start app if needed' })).not.toBeChecked()
  })

  it('keeps Run unavailable when no workflows are accessible', async () => {
    vi.mocked(listRunnableAutomationsAction).mockResolvedValue([])
    render(<AppAutomationRunAction />)
    fireEvent.click(screen.getByRole('button', { name: 'Run workflow' }))
    const dialog = await screen.findByRole('dialog', { name: 'Run workflow' })
    expect(await within(dialog).findByText(/No workflows are available/)).toBeVisible()
    expect(within(dialog).getByRole('button', { name: 'Run workflow' })).toBeDisabled()
    expect(runAutomationAction).not.toHaveBeenCalled()
  })
})
