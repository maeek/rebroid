import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApplicationProfileSelect } from './application-profile-select'

const savedProfiles = [
  { mode: 'persistent' as const, name: 'default' },
  { mode: 'persistent' as const, name: 'work' }
]

const openSelect = () => {
  fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' })
}

describe('ApplicationProfileSelect', () => {
  it('selects a temporary profile', () => {
    const onModeChange = vi.fn()
    const onNameChange = vi.fn()
    render(
      <ApplicationProfileSelect
        mode='persistent'
        name='default'
        savedProfiles={savedProfiles}
        onModeChange={onModeChange}
        onNameChange={onNameChange}
      />
    )

    openSelect()
    fireEvent.pointerDown(screen.getByText('Temporary'), { pointerType: 'mouse' })
    fireEvent.click(screen.getByText('Temporary'))

    expect(onModeChange).toHaveBeenCalledWith('temporary')
    expect(onNameChange).not.toHaveBeenCalled()
  })

  it('selects a saved persistent profile', () => {
    const onModeChange = vi.fn()
    const onNameChange = vi.fn()
    render(
      <ApplicationProfileSelect
        mode='persistent'
        name='default'
        savedProfiles={savedProfiles}
        onModeChange={onModeChange}
        onNameChange={onNameChange}
      />
    )

    openSelect()
    fireEvent.pointerDown(screen.getByText('work'), { pointerType: 'mouse' })
    fireEvent.click(screen.getByText('work'))

    expect(onModeChange).toHaveBeenCalledWith('persistent')
    expect(onNameChange).toHaveBeenCalledWith('work')
  })

  it('reveals the new profile input', () => {
    const onModeChange = vi.fn()
    const onNameChange = vi.fn()
    render(
      <ApplicationProfileSelect
        mode='persistent'
        name='default'
        savedProfiles={savedProfiles}
        onModeChange={onModeChange}
        onNameChange={onNameChange}
      />
    )

    openSelect()
    fireEvent.pointerDown(screen.getByText('New profile'), { pointerType: 'mouse' })
    fireEvent.click(screen.getByText('New profile'))

    expect(onModeChange).toHaveBeenCalledWith('persistent')
    expect(onNameChange).toHaveBeenCalledWith('')
    expect(screen.getByPlaceholderText('default')).not.toBeNull()
  })

  it('shows delete actions only when deletion is allowed', () => {
    const { rerender } = render(
      <ApplicationProfileSelect
        mode='persistent'
        name='default'
        savedProfiles={savedProfiles}
        selectedProfile={{ mode: 'persistent', name: 'default' }}
        onNameChange={vi.fn()}
      />
    )

    openSelect()
    expect(screen.queryByRole('button', { name: 'Remove work' })).toBeNull()

    rerender(
      <ApplicationProfileSelect
        mode='persistent'
        name='default'
        savedProfiles={savedProfiles}
        selectedProfile={{ mode: 'persistent', name: 'default' }}
        canDeleteProfiles
        onDeleteProfile={() => undefined}
        onNameChange={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Remove work' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Remove default' })).toBeNull()
  })

  it('does not select a profile when the delete action is clicked', async () => {
    const onNameChange = vi.fn()
    const onDeleteProfile = vi.fn()
    const deleteProfile = (profileName: string) => {
      onDeleteProfile(profileName)
      return Promise.resolve()
    }
    render(
      <ApplicationProfileSelect
        mode='persistent'
        name='default'
        savedProfiles={savedProfiles}
        selectedProfile={{ mode: 'persistent', name: 'default' }}
        canDeleteProfiles
        onDeleteProfile={deleteProfile}
        onNameChange={onNameChange}
      />
    )

    openSelect()
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Remove work' }), { pointerType: 'mouse' })
    fireEvent.click(screen.getByRole('button', { name: 'Remove work' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove profile' }))

    await waitFor(() => expect(onDeleteProfile).toHaveBeenCalledWith('work'))
    expect(onNameChange).not.toHaveBeenCalledWith('work')
  })
  it('shows the configured persistent profile before its saved data is created', () => {
    render(
      <ApplicationProfileSelect
        mode='persistent'
        name='default'
        savedProfiles={[]}
        onNameChange={vi.fn()}
      />
    )
    expect(screen.getByRole('combobox', { name: 'Profile' })).toHaveTextContent('default')
  })

  it('retains a failed removal for retry instead of rejecting outside the dialog', async () => {
    const remove = vi.fn().mockRejectedValueOnce(new Error('Profile is in use.')).mockResolvedValueOnce(undefined)
    render(
      <ApplicationProfileSelect
        mode='persistent'
        name='default'
        savedProfiles={savedProfiles}
        selectedProfile={{ mode: 'persistent', name: 'default' }}
        canDeleteProfiles
        onDeleteProfile={remove}
        onNameChange={vi.fn()}
      />
    )
    openSelect()
    fireEvent.click(screen.getByRole('button', { name: 'Remove work' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove profile' }))
    expect(await screen.findByText('Profile is in use.')).toBeVisible()
    expect(screen.getByRole('dialog', { name: 'Remove profile?' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Remove profile' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(remove).toHaveBeenCalledTimes(2)
  })
})
