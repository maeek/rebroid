import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getBff } from '@/lib/http/bff'
import { pullPlatformImageAction } from '@/server/orchestrator/platform/image-actions'
import { actionError, actionOk } from '@/shared/actions/action-result'
import { RuntimeImagePullForm } from './runtime-image-pull-form'

vi.mock('@/lib/http/bff', () => ({ getBff: vi.fn() }))

vi.mock('@/server/orchestrator/platform/image-actions', () => ({
  pullPlatformImageAction: vi.fn()
}))

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))

describe('RuntimeImagePullForm', () => {
  it('keeps the draft on failure and refreshes the inventory after a confirmed retry', async () => {
    const onPulled = vi.fn()
    const pull = Promise.withResolvers<Awaited<ReturnType<typeof pullPlatformImageAction>>>()
    vi.mocked(pullPlatformImageAction)
      .mockReturnValueOnce(pull.promise)
      .mockResolvedValueOnce(actionOk({ id: 'job', image: 'docker.io/alpine:3', phase: 'queued' }))
    const progress = Promise.withResolvers<{ id: string; image: string; phase: string }>()
    vi.mocked(getBff)
      .mockReturnValueOnce(progress.promise)
      .mockResolvedValueOnce({ id: 'job', image: 'docker.io/alpine:3', phase: 'pulled' })
    render(<RuntimeImagePullForm onPulled={onPulled} />)

    const image = screen.getByRole('textbox', { name: /Image/ })
    const submit = screen.getByRole('button', { name: 'Pull image' })
    expect(submit).toBeDisabled()
    fireEvent.change(image, { target: { value: 'alpine:3' } })
    fireEvent.click(submit)

    expect(screen.getByRole('button', { name: 'Submitting pull request…' })).toBeDisabled()
    expect(image).toBeDisabled()
    expect(pullPlatformImageAction).toHaveBeenCalledWith('docker-hub', 'alpine:3')
    expect(onPulled).not.toHaveBeenCalled()

    pull.resolve(actionError({ message: 'The registry rejected the pull.', requestId: 'pull-request' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Request ID pull-request')
    expect(image).toHaveValue('alpine:3')
    expect(onPulled).not.toHaveBeenCalled()

    await waitFor(() => expect(submit).toBeEnabled())
    fireEvent.click(submit)
    expect(await screen.findByRole('button', { name: 'Waiting for Docker…' })).toBeDisabled()
    expect(onPulled).not.toHaveBeenCalled()
    progress.resolve({ id: 'job', image: 'docker.io/alpine:3', phase: 'transferring-layers' })
    expect(await screen.findByRole('button', { name: 'Downloading and extracting layers…' })).toBeDisabled()
    await waitFor(() => expect(onPulled).toHaveBeenCalledTimes(1), { timeout: 3000 })
    expect(image).toHaveValue('')
  })
})
