import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { pullPlatformImageAction } from '@/server/orchestrator/platform/image-actions'
import { actionError, actionOk } from '@/shared/actions/action-result'
import { RuntimeImagePullForm } from './runtime-image-pull-form'

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
      .mockResolvedValueOnce(actionOk({ image: 'docker.io/alpine:3', status: 'pulled' }))
    render(<RuntimeImagePullForm onPulled={onPulled} />)

    const image = screen.getByRole('textbox', { name: /Image/ })
    const submit = screen.getByRole('button', { name: 'Pull image' })
    expect(submit).toBeDisabled()
    fireEvent.change(image, { target: { value: 'alpine:3' } })
    fireEvent.click(submit)

    expect(screen.getByRole('button', { name: 'Pulling image…' })).toBeDisabled()
    expect(image).toBeDisabled()
    expect(pullPlatformImageAction).toHaveBeenCalledWith('docker-hub', 'alpine:3')
    expect(onPulled).not.toHaveBeenCalled()

    pull.resolve(actionError({ message: 'The registry rejected the pull.', requestId: 'pull-request' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Request ID pull-request')
    expect(image).toHaveValue('alpine:3')
    expect(onPulled).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Pull image' }))
    await waitFor(() => expect(onPulled).toHaveBeenCalledTimes(1))
    expect(image).toHaveValue('')
  })
})
