import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { actionError, actionOk } from '@/shared/actions/action-result'
import { ProfilePhotoSettings } from './profile-photo-settings'

const original = 'data:image/webp;base64,original'
const replacement = 'data:image/webp;base64,replacement'
const mocks = vi.hoisted(() => ({ prepare: vi.fn(), save: vi.fn(), saved: vi.fn(), toast: vi.fn() }))
vi.mock('@/shared/model/media/icon-metadata', () => ({ optimizeIconFile: mocks.prepare }))
vi.mock('@/server/users/actions/update-current-profile-action', () => ({ updateCurrentProfileAction: mocks.save }))
vi.mock('@/hooks/use-toast', () => ({ toast: mocks.toast }))

const Harness = () => {
  const [open, setOpen] = useState(true)
  return (
    <>
      <button onClick={() => setOpen(current => !current)}>{open ? 'Leave preferences' : 'Open preferences'}</button>
      {open ? (
        <ProfilePhotoSettings
          name='Ada'
          avatar={original}
          onSaved={mocks.saved}
        />
      ) : null}
    </>
  )
}

const choosePhoto = () =>
  fireEvent.change(screen.getByLabelText('Profile photo'), {
    target: { files: [new File(['photo'], 'replacement.png', { type: 'image/png' })] }
  })

describe('profile photo saving', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prepare.mockResolvedValue(replacement)
  })

  it('previews locally and persists only when Save photo is pressed', async () => {
    mocks.save.mockResolvedValue(actionOk({ avatarDataUrl: replacement }))
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'Save photo' })).toBeDisabled()
    choosePhoto()
    await waitFor(() => expect(screen.getByText('replacement.png')).toBeVisible())
    expect(mocks.save).not.toHaveBeenCalled()
    expect(mocks.saved).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Save photo' }))
    await waitFor(() => expect(mocks.saved).toHaveBeenCalledOnce())
    expect(mocks.save).toHaveBeenCalledExactlyOnceWith({ avatarDataUrl: replacement })
    expect(screen.getByRole('button', { name: 'Saved' })).toBeDisabled()
  })

  it('discards a replacement on leaving preferences and stages removal until Save', async () => {
    mocks.save.mockResolvedValue(actionOk({ avatarDataUrl: null }))
    render(<Harness />)
    choosePhoto()
    await waitFor(() => expect(screen.getByText('replacement.png')).toBeVisible())
    fireEvent.click(screen.getByRole('button', { name: 'Leave preferences' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open preferences' }))
    expect(screen.getByText('Current photo')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Save photo' })).toBeDisabled()
    expect(mocks.save).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }))
    expect(screen.getByText('Using initials')).toBeVisible()
    expect(mocks.save).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Save photo' }))
    await waitFor(() => expect(mocks.saved).toHaveBeenCalledOnce())
    expect(mocks.save).toHaveBeenCalledExactlyOnceWith({ avatarDataUrl: null })
  })

  it('retains the preview after a failed save and discards filename metadata with the draft', async () => {
    mocks.save.mockResolvedValue(actionError({ message: 'Unable to save photo' }))
    render(<Harness />)
    choosePhoto()
    await waitFor(() => expect(screen.getByText('replacement.png')).toBeVisible())
    fireEvent.click(screen.getByRole('button', { name: 'Save photo' }))
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'danger' })))
    expect(mocks.saved).not.toHaveBeenCalled()
    expect(screen.getByText('replacement.png')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Save photo' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(screen.queryByText('replacement.png')).toBeNull()
    expect(screen.getByText('Current photo')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Save photo' })).toBeDisabled()
  })

  it('blocks saving during image preparation and duplicate submissions while saving', async () => {
    let prepared: (value: string) => void = () => undefined
    let saved: (value: unknown) => void = () => undefined
    mocks.prepare.mockImplementation(
      () =>
        new Promise(resolve => {
          prepared = resolve
        })
    )
    mocks.save.mockImplementation(
      () =>
        new Promise(resolve => {
          saved = resolve
        })
    )
    render(<Harness />)
    choosePhoto()
    expect(screen.getByRole('button', { name: 'Save photo' })).toBeDisabled()
    prepared(replacement)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save photo' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Save photo' }))
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove photo' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Saving…' }))
    expect(mocks.save).toHaveBeenCalledTimes(1)
    saved(actionOk({ avatarDataUrl: replacement }))
    await waitFor(() => expect(mocks.saved).toHaveBeenCalledOnce())
  })
})
