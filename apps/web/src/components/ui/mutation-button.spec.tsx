import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MutationButton } from './mutation-button'

describe('MutationButton state feedback', () => {
  it('keeps the successful result visible when animation is explicitly disabled', () => {
    render(
      <MutationButton
        success
        animate={false}
      >
        Save
      </MutationButton>
    )
    expect(screen.getByRole('button', { name: 'Saved' })).toBeEnabled()
  })

  it('exposes only the current label and requires explicit success after pending ends', () => {
    const { rerender } = render(
      <MutationButton
        pending
        success={false}
        pendingLabel='Saving…'
      >
        Save
      </MutationButton>
    )
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('button', { name: 'Saved' })).toBeNull()

    rerender(
      <MutationButton
        success={false}
        pendingLabel='Saving…'
      >
        Save
      </MutationButton>
    )
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Saved' })).toBeNull()

    rerender(
      <MutationButton
        success
        pendingLabel='Saving…'
      >
        Save
      </MutationButton>
    )
    expect(screen.getByRole('button', { name: 'Saved' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('keeps pending and external disabled states authoritative over success', () => {
    const { rerender } = render(
      <MutationButton
        pending
        success
        pendingLabel='Saving…'
      >
        Save
      </MutationButton>
    )
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    rerender(
      <MutationButton
        disabled
        success
        pendingLabel='Saving…'
      >
        Save
      </MutationButton>
    )
    expect(screen.getByRole('button', { name: 'Saved' })).toBeDisabled()
  })
})
