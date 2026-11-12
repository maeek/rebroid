import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { saveWorkflowHistoryRetentionAction } from '@/server/orchestrator/scheduled-tasks/actions'
import { actionError, actionOk } from '@/shared/actions/action-result'
import { WorkflowHistoryRetentionControl } from './workflow-history-retention-control'

vi.mock('@/server/orchestrator/scheduled-tasks/actions', () => ({ saveWorkflowHistoryRetentionAction: vi.fn() }))

describe('workflow run history retention control', () => {
  it('keeps the entered value on error and saves it on retry', async () => {
    vi.mocked(saveWorkflowHistoryRetentionAction)
      .mockResolvedValueOnce(actionError({ message: 'Could not save retention.', requestId: 'save-123' }))
      .mockResolvedValueOnce(actionOk({ retentionDays: 14, enabled: false }))
    render(<WorkflowHistoryRetentionControl initial={actionOk({ retentionDays: 7, enabled: false })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Run history retention' }))
    const dialog = await screen.findByRole('dialog', { name: 'Workflow run history retention' })
    const days = within(dialog).getByRole('spinbutton', { name: 'Retention days' })
    const save = within(dialog).getByRole('button', { name: 'Save retention' })
    expect(days).toHaveValue(7)
    expect(within(dialog).getByText('Automatic cleanup is paused in Maintenance tasks.')).toBeVisible()

    fireEvent.change(days, { target: { value: '14' } })
    fireEvent.click(save)
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Request ID save-123')
    expect(days).toHaveValue(14)

    fireEvent.click(save)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(saveWorkflowHistoryRetentionAction).toHaveBeenCalledWith(14)
  })
})
