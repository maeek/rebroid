import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  pruneAllDockerResourcesAction,
  pruneContainersAction,
  pruneImagesAction,
  pruneNetworksAction,
  pruneVolumesAction
} from '@/server/orchestrator/docker-maintenance/actions'
import { cleanupUploadedApksAction } from '@/server/orchestrator/settings/actions'
import { PlatformRuntimeMaintenanceSection } from './platform-runtime-maintenance-section'

vi.mock('@/server/orchestrator/docker-maintenance/actions', () => ({
  pruneAllDockerResourcesAction: vi.fn(() => Promise.resolve({ ok: true, requestId: 'test', data: {} })),
  pruneContainersAction: vi.fn(() =>
    Promise.resolve({
      ok: true,
      requestId: 'test',
      data: { ContainersDeleted: ['container'] }
    })
  ),
  pruneImagesAction: vi.fn(() =>
    Promise.resolve({
      ok: true,
      requestId: 'test',
      data: { ImagesDeleted: [], SpaceReclaimed: 1024 }
    })
  ),
  pruneNetworksAction: vi.fn(() => Promise.resolve({ ok: true, requestId: 'test', data: {} })),
  pruneVolumesAction: vi.fn(() => Promise.resolve({ ok: true, requestId: 'test', data: {} }))
}))
vi.mock('@/server/orchestrator/settings/actions', () => ({
  cleanupUploadedApksAction: vi.fn(() => Promise.resolve({ deletedRecords: 2, removedFiles: 2 }))
}))

beforeEach(() => {
  vi.clearAllMocks()
})
describe('Runtime maintenance', () => {
  it.each([
    ['unused apk uploads', cleanupUploadedApksAction],
    ['dangling images', pruneImagesAction],
    ['stopped containers', pruneContainersAction],
    ['unused networks', pruneNetworksAction],
    ['unused volumes', pruneVolumesAction],
    ['full docker cleanup', pruneAllDockerResourcesAction]
  ] as const)('confirms %s and calls only the selected operation', async (label, action) => {
    const completed = vi.fn()
    render(<PlatformRuntimeMaintenanceSection onMaintenanceComplete={completed} />)
    fireEvent.click(screen.getByRole('button', { name: `Clean up ${label}` }))
    const dialog = await screen.findByRole('dialog')
    expect(action).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Clean up' }))
    await waitFor(() => expect(completed).toHaveBeenCalledOnce())
    expect(action).toHaveBeenCalledOnce()
    expect(screen.getByRole('status')).toHaveTextContent('cleanup complete')
    if (label === 'dangling images') expect(pruneImagesAction).toHaveBeenCalledWith(true)
    const calls = [
      pruneAllDockerResourcesAction,
      pruneContainersAction,
      pruneImagesAction,
      pruneNetworksAction,
      pruneVolumesAction,
      cleanupUploadedApksAction
    ]
    expect(calls.reduce((sum, operation) => sum + vi.mocked(operation).mock.calls.length, 0)).toBe(1)
  })

  it('canceling volume cleanup never performs a deletion', async () => {
    render(<PlatformRuntimeMaintenanceSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Clean up unused volumes' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/cannot be recovered/)).toBeVisible()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(pruneVolumesAction).not.toHaveBeenCalled()
  })

  it('keeps cleanup pending and prevents duplicate submissions', async () => {
    let complete!: (value: Awaited<ReturnType<typeof pruneContainersAction>>) => void
    vi.mocked(pruneContainersAction).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          complete = resolve
        })
    )
    render(<PlatformRuntimeMaintenanceSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Clean up stopped containers' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Clean up' }))
    const pendingButton = within(dialog).getByRole('button', { name: 'Cleaning up…' })
    expect(pendingButton).toBeDisabled()
    expect(pendingButton).toHaveAttribute('aria-busy', 'true')
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    fireEvent.click(pendingButton)
    expect(pruneContainersAction).toHaveBeenCalledOnce()
    complete({ ok: true, requestId: 'test', data: {} })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('status')).toHaveTextContent('cleanup complete')
  })

  it('reports failed operations without success feedback', async () => {
    vi.mocked(pruneContainersAction).mockRejectedValueOnce(new Error('Docker unavailable'))
    render(<PlatformRuntimeMaintenanceSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Clean up stopped containers' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Clean up' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Docker unavailable'))
    expect(screen.queryByText(/cleanup complete/)).toBeNull()
  })
})
