import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BuildSection } from './build-section'
import type { ContainerImageBuildJob } from '@/shared/contracts/platform'

const job = {
  id: 'job-1',
  status: 'running',
  targetImage: 'local/custom:latest',
  logTail: `Building ${'a'.repeat(300)}`
} as ContainerImageBuildJob

describe('BuildSection', () => {
  it('contains long live logs and exposes visible running feedback', () => {
    render(
      <BuildSection
        activeJob={job}
        canStart={false}
        isActiveJobRunning
        isCancelling={false}
        isStarting={false}
        onCancelBuild={vi.fn()}
        onSetAsDefault={vi.fn()}
        onStartBuild={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Build in progress' })).toHaveAttribute('aria-busy', 'true')
    const log = screen.getByText(content => content.startsWith('Building '))
    expect(log).toHaveClass('max-w-full', 'min-w-0', 'overflow-auto', 'whitespace-pre')
  })

  it('shows pending cancellation feedback', () => {
    render(
      <BuildSection
        activeJob={job}
        canStart={false}
        isActiveJobRunning
        isCancelling
        isStarting={false}
        onCancelBuild={vi.fn()}
        onSetAsDefault={vi.fn()}
        onStartBuild={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Cancelling…' })).toHaveAttribute('aria-busy', 'true')
  })
})
