import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserAvatarInput } from './user-avatar-input'
const mocks = vi.hoisted(() => ({ prepare: vi.fn(), pending: vi.fn() }))
vi.mock('@/shared/model/media/icon-metadata', () => ({ optimizeIconFile: mocks.prepare }))
const Harness = () => {
  const [avatar, setAvatar] = useState<string | null>('data:image/webp;base64,original')
  return (
    <>
      <UserAvatarInput
        name='Ada'
        avatar={avatar}
        onChange={setAvatar}
        onPendingChange={mocks.pending}
      />
      <output data-testid='avatar'>{avatar ?? 'initials'}</output>
    </>
  )
}
const file = () => new File(['photo'], 'profile.png', { type: 'image/png' })

describe('UserAvatarInput', () => {
  beforeEach(() => vi.clearAllMocks())
  it('opens the native picker from a real button and allows selecting the same file again', async () => {
    mocks.prepare.mockResolvedValue('data:image/webp;base64,new')
    render(<Harness />)
    const input = screen.getByLabelText('Profile photo')
    const click = vi.spyOn(input, 'click')
    fireEvent.click(screen.getByRole('button', { name: 'Change photo' }))
    expect(click).toHaveBeenCalledOnce()
    fireEvent.change(input, { target: { files: [file()] } })
    await waitFor(() => expect(screen.getByTestId('avatar')).toHaveTextContent('base64,new'))
    expect(screen.getByText('profile.png')).toHaveTextContent('profile.png')
    fireEvent.change(input, { target: { files: [file()] } })
    await waitFor(() => expect(mocks.prepare).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }))
    expect(screen.getByTestId('avatar')).toHaveTextContent('initials')
    expect(screen.getByText('Using initials')).toBeVisible()
  })
  it('retains the current photo on failure, exposes an inline error, and disables controls during processing', async () => {
    let reject: (error: Error) => void = () => undefined
    mocks.prepare.mockImplementation(
      () =>
        new Promise((_, fail) => {
          reject = fail
        })
    )
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Profile photo'), { target: { files: [file()] } })
    expect(screen.getByRole('button', { name: 'Preparing…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove photo' })).toBeDisabled()
    reject(new Error('Could not load image'))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not load image'))
    expect(screen.getByTestId('avatar')).toHaveTextContent('base64,original')
    expect(screen.getByRole('button', { name: 'Change photo' })).toHaveAttribute('aria-invalid', 'true')
    expect(mocks.pending).toHaveBeenLastCalledWith(false)
  })
  it('rejects unsupported files without replacing the current photo', () => {
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Profile photo'), {
      target: { files: [new File(['text'], 'bad.svg', { type: 'image/svg+xml' })] }
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a PNG, JPEG, or WebP')
    expect(mocks.prepare).not.toHaveBeenCalled()
    expect(screen.getByTestId('avatar')).toHaveTextContent('base64,original')
  })
})
