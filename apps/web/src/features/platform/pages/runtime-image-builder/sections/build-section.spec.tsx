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
        isActiveJobRunning
        isCancelling={false}
        onCancelBuild={vi.fn()}
        onSetAsDefault={vi.fn()}
      />
    )

    expect(screen.getByRole('heading', { name: 'Build status' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Cancel build' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Build image' })).toBeNull()
    const log = screen.getByText(content => content.startsWith('Building '))
    expect(log).toHaveClass('max-w-full', 'min-w-0', 'overflow-auto', 'whitespace-pre')
  })

  it('shows pending cancellation feedback', () => {
    render(
      <BuildSection
        activeJob={job}
        isActiveJobRunning
        isCancelling
        onCancelBuild={vi.fn()}
        onSetAsDefault={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Cancelling…' })).toHaveAttribute('aria-busy', 'true')
  })
})
