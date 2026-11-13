import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { AppStartupTimingsSection } from './app-startup-timings'

it('shows recorded startup time and distinguishes an unobserved first frame', () => {
  const at = Date.parse('2026-11-13T00:59:27Z')
  const { rerender } = render(
    <AppStartupTimingsSection
      timings={{
        baseline: at,
        firstFrameAt: null,
        milestones: [
          { label: 'Container creation started', at },
          { label: 'First frame in this tab', at: null }
        ]
      }}
    />
  )
  expect(screen.getByRole('heading', { name: 'Startup timings' })).toBeVisible()
  expect(screen.getAllByText('Not recorded yet')).toHaveLength(2)
  rerender(
    <AppStartupTimingsSection
      timings={{
        baseline: at,
        firstFrameAt: at + 36340,
        milestones: [
          { label: 'Container creation started', at },
          { label: 'First frame in this tab', at: at + 36340 }
        ]
      }}
    />
  )
  expect(screen.getByText('36.3 s')).toBeVisible()
  expect(screen.getByText('+36.3 s')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Copy First frame in this tab' })).toBeInTheDocument()
})
