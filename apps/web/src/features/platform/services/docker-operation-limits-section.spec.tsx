import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DockerOperationLimitsSection } from './docker-operation-limits-section'

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  send: vi.fn(),
  mutate: vi.fn(),
  toast: vi.fn()
}))
vi.mock('@/hooks/use-polling-query', () => ({ usePollingQuery: mocks.query }))
vi.mock('@/lib/http/bff', () => ({ getBff: vi.fn(), sendBff: mocks.send }))
vi.mock('@/hooks/use-toast', () => ({ toast: mocks.toast }))

const limits = {
  maxConcurrentReads: 8,
  maxConcurrentLongOperations: 4,
  slowRequestWarningMs: 5000,
  longOperationTimeoutMs: 1_800_000
}
const openEditor = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Edit limits' }))
  expect(screen.getByRole('dialog', { name: 'Edit operation limits' })).toBeVisible()
}

describe('Docker operation limits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.query.mockReturnValue({ data: limits, isLoading: false, isValidating: false, mutate: mocks.mutate })
    mocks.mutate.mockResolvedValue(limits)
  })

  it('shows a readable saved summary and discards cancelled edits', async () => {
    render(<DockerOperationLimitsSection onSaved={vi.fn()} />)
    expect(screen.getByText('5 seconds')).toBeVisible()
    expect(screen.getByText('30 minutes')).toBeVisible()
    expect(screen.queryByRole('spinbutton')).toBeNull()
    openEditor()
    fireEvent.change(screen.getByLabelText('Concurrent reads'), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    openEditor()
    expect(screen.getByLabelText('Concurrent reads')).toHaveValue(8)
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('retains failed drafts and saves exact values only after explicit Save', async () => {
    mocks.send
      .mockRejectedValueOnce(new Error('Docker unavailable.'))
      .mockResolvedValueOnce({ ...limits, maxConcurrentReads: 12 })
    const onSaved = vi.fn()
    render(<DockerOperationLimitsSection onSaved={onSaved} />)
    openEditor()
    fireEvent.change(screen.getByLabelText('Concurrent reads'), { target: { value: '12' } })
    expect(mocks.send).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Save limits' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Docker unavailable.'))
    expect(screen.getByLabelText('Concurrent reads')).toHaveValue(12)
    expect(onSaved).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Save limits' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mocks.send).toHaveBeenLastCalledWith(
      '/api/bff/platform/docker-operation-limits',
      { ...limits, maxConcurrentReads: 12 },
      'PATCH'
    )
    expect(onSaved).toHaveBeenCalledOnce()
  })

  it('blocks invalid values and associates help with the actual input', () => {
    render(<DockerOperationLimitsSection onSaved={vi.fn()} />)
    openEditor()
    const reads = screen.getByLabelText('Concurrent reads')
    expect(reads).toHaveAccessibleDescription('Maximum Docker read operations in flight.')
    fireEvent.change(reads, { target: { value: '65' } })
    expect(screen.getByRole('button', { name: 'Save limits' })).toBeDisabled()
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('keeps loading inert and prevents closing during a save', async () => {
    const view = render(
      <DockerOperationLimitsSection
        loading
        onSaved={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Edit limits' })).toBeDisabled()
    expect(mocks.query).toHaveBeenLastCalledWith('docker:operation-limits', expect.any(Function), {
      intervalMs: null,
      enabled: false
    })
    view.rerender(<DockerOperationLimitsSection onSaved={vi.fn()} />)
    let resolveSave: ((value: typeof limits) => void) | undefined
    mocks.send.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveSave = resolve
        })
    )
    openEditor()
    fireEvent.change(screen.getByLabelText('Concurrent reads'), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save limits' }))
    expect(screen.getByRole('button', { name: 'Saving…' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.getByRole('dialog')).toBeVisible()
    resolveSave?.({ ...limits, maxConcurrentReads: 12 })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
