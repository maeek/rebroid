import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StateView } from './state-view'

describe('StateView', () => {
  it('presents a role rule as information without a fake recovery action', () => {
    render(
      <StateView
        kind='not-applicable'
        title='Unlimited quotas'
        description='Administrators are not restricted by quotas.'
      />
    )
    expect(screen.getByRole('status')).toHaveTextContent('Unlimited quotas')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('keeps a failure reason, reference, and working retry action together', () => {
    const retry = vi.fn()
    render(
      <StateView
        kind='unavailable'
        title='Settings unavailable'
        description='Could not load settings.'
        requestId='request-123'
        actions={[{ label: 'Try again', onClick: retry }]}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Reference: request-123')
    const button = screen.getByRole('button', { name: 'Try again' })
    expect(button).toHaveClass('border-transparent', 'hover:bg-accent')
    fireEvent.click(button)
    expect(retry).toHaveBeenCalledOnce()
  })

  it('keeps retry pending and disabled until the refresh completes', () => {
    render(
      <StateView
        kind='unavailable'
        title='Settings unavailable'
        description='Could not load settings.'
        actions={[{ label: 'Try again', pending: true, pendingLabel: 'Retrying…', onClick: vi.fn() }]}
      />
    )
    expect(screen.getByRole('button', { name: 'Retrying…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Retrying…' })).toHaveAttribute('aria-busy', 'true')
  })
})
