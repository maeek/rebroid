import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { updateScheduledTaskAction } from '@/server/orchestrator/scheduled-tasks/actions'
import { ScheduledTasksPage } from './scheduled-tasks-page'
import { schedulerPreviewActions, schedulerPreviewTasks } from './scheduled-tasks-preview'

vi.mock('@/server/orchestrator/scheduled-tasks/actions', () => ({
  createScheduledTaskAction: vi.fn(),
  deleteScheduledTaskAction: vi.fn(),
  runScheduledTaskNowAction: vi.fn(),
  updateScheduledTaskAction: vi.fn()
}))

const renderPage = () =>
  render(
    <ScheduledTasksPage
      initialActions={schedulerPreviewActions}
      initialTasks={schedulerPreviewTasks}
    />
  )

describe('Scheduler page', () => {
  it('opens a named task for editing and preserves built-in restrictions', async () => {
    renderPage()
    const task = screen.getByRole('button', { name: 'Clean APK uploads' })
    const row = screen.getByRole('row', { name: /Clean APK uploads/ })
    expect(within(row).getAllByText('Clean APK uploads')).toHaveLength(1)
    expect(within(row).queryByText('Enabled')).toBeNull()
    fireEvent.click(task)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText(/Name/)).toBeDisabled()
    expect(within(dialog).getByRole('combobox', { name: 'Action' })).toBeDisabled()
    expect(within(dialog).getByRole('switch', { name: 'Enabled' })).toBeChecked()
  })

  it('updates availability from the row and keeps the switch in sync', async () => {
    const task = schedulerPreviewTasks[0]
    vi.mocked(updateScheduledTaskAction).mockResolvedValue({ ...task, enabled: false, nextRunAt: null })
    renderPage()
    fireEvent.click(screen.getByRole('switch', { name: 'Disable Clean APK uploads' }))
    await waitFor(() => expect(updateScheduledTaskAction).toHaveBeenCalledWith(task.id, { enabled: false }))
    expect(await screen.findByRole('switch', { name: 'Enable Clean APK uploads' })).not.toBeChecked()
  })

  it('shows and saves image build history retention on the built-in task', async () => {
    const task = {
      ...schedulerPreviewTasks[0],
      id: 'build-history',
      name: 'Image build history retention',
      actionType: 'clean_image_build_history',
      payload: { retentionDays: 30 }
    } as const
    vi.mocked(updateScheduledTaskAction).mockResolvedValue({ ...task, payload: { retentionDays: 60 } })
    render(
      <ScheduledTasksPage
        initialActions={[{ type: task.actionType, label: task.name, description: 'Remove old completed builds.' }]}
        initialTasks={[task]}
      />
    )

    const row = screen.getByRole('row', { name: /Image build history retention/ })
    expect(within(row).getByText('Built-in · 30 days')).toBeVisible()
    fireEvent.click(within(row).getByRole('button', { name: task.name }))
    const dialog = await screen.findByRole('dialog')
    const retention = within(dialog).getByRole('spinbutton', { name: 'Keep completed image builds for' })
    expect(retention).toHaveValue(30)
    fireEvent.change(retention, { target: { value: '60' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(updateScheduledTaskAction).toHaveBeenCalledWith(
        task.id,
        expect.objectContaining({ payload: { retentionDays: 60 } })
      )
    )
    expect(await screen.findByText('Built-in · 60 days')).toBeVisible()
  })

  it('shows availability only on the switch and avoids repeating built-in action names', () => {
    renderPage()
    const paused = screen.getByRole('row', { name: /Full Docker cleanup/ })
    expect(within(paused).getByRole('switch', { name: 'Enable Full Docker cleanup' })).not.toBeChecked()
    expect(within(paused).queryByText('Paused')).toBeNull()
    expect(within(paused).queryByText('Full cleanup')).toBeNull()
    expect(within(paused).getByLabelText('No scheduled run')).toHaveTextContent('—')
    expect(within(paused).getByText('Day 1 of each month')).toBeVisible()
    expect(within(paused).getByText('05:00')).toBeVisible()
    const imageTask = screen.getByRole('row', { name: /Prune Docker images/ })
    expect(within(imageTask).getByText('Built-in')).toBeVisible()
    expect(within(imageTask).queryByText('Prune images')).toBeNull()
  })

  it('keeps long failure output out of rows while making the full error accessible', async () => {
    renderPage()
    const task = schedulerPreviewTasks.at(-1)!
    const row = screen.getByRole('row', { name: /Weekend image cleanup/ })
    expect(within(row).queryByText(task.lastError!)).toBeNull()
    fireEvent.click(within(row).getByRole('button', { name: `View failed run for ${task.name}` }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(task.lastError!)).toBeVisible()
    expect(within(dialog).getByRole('heading', { name: 'Last run failed' })).toBeVisible()
    expect(within(dialog).queryByRole('textbox')).toBeNull()
  })

  it('saves custom task changes with its schedule and action options intact', async () => {
    const task = schedulerPreviewTasks.at(-1)!
    vi.mocked(updateScheduledTaskAction).mockResolvedValue({ ...task, name: 'Sunday cleanup' })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: task.name }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/Name/), { target: { value: 'Sunday cleanup' } })
    expect(within(dialog).getByRole('switch', { name: 'Dangling images only' })).not.toBeChecked()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(updateScheduledTaskAction).toHaveBeenCalledWith(
        task.id,
        expect.objectContaining({
          name: 'Sunday cleanup',
          enabled: false,
          actionType: 'prune_images',
          cronExpression: task.cronExpression,
          payload: { danglingOnly: false }
        })
      )
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('button', { name: 'Sunday cleanup' })).toBeVisible()
  })
})
