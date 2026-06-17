import { describe, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ApplicationProfileSelect } from './application-profile-select'

const savedProfiles = [
  { mode: 'persistent' as const, name: 'default' },
  { mode: 'persistent' as const, name: 'work' }
]

const openSelect = () => {
  fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' })
}

describe('ApplicationProfileSelect', () => {
  it('selects a temporary profile', async () => {
    const onModeChange = jest.fn()
    const onNameChange = jest.fn()
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
    const onModeChange = jest.fn()
    const onNameChange = jest.fn()
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
    const onModeChange = jest.fn()
    const onNameChange = jest.fn()
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
        onNameChange={jest.fn()}
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
        onNameChange={jest.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Remove work' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Remove default' })).toBeNull()
  })

  it('does not select a profile when the delete action is clicked', async () => {
    const onNameChange = jest.fn()
    const onDeleteProfile = jest.fn()
    const deleteProfile = async (profileName: string) => {
      onDeleteProfile(profileName)
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
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(onDeleteProfile).toHaveBeenCalledWith('work'))
    expect(onNameChange).not.toHaveBeenCalledWith('work')
  })
})
