import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OperationProgress } from './operation-progress'

describe('OperationProgress', () => {
  it('does not invent progress when it is unknown and bounds measured values', () => {
    const { rerender } = render(
      <OperationProgress
        label='Download'
        value={null}
      />
    )
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'In progress')
    rerender(
      <OperationProgress
        label='Download'
        value={105}
      />
    )
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    rerender(
      <OperationProgress
        label='Download'
        value={100}
        active={false}
      />
    )
    expect(screen.queryByRole('progressbar')).toBeNull()
  })
})
