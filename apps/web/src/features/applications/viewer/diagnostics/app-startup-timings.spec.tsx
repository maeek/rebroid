import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { AppStartupTimingsSection } from './app-startup-timings'

it('shows elapsed times for recorded milestones and only includes the first frame once observed', () => {
  const at = Date.parse('2026-11-13T00:59:27Z')
  const { rerender } = render(
    <AppStartupTimingsSection
      timings={{
        baseline: at,
        firstFrameAt: null,
        milestones: [
          { label: 'Container creation started', at },
          { label: 'Container created', at: at + 100 }
        ]
      }}
    />
  )
  expect(screen.getByRole('heading', { name: 'Startup timings' })).toBeVisible()
  expect(screen.getByText('+0.1 s')).toBeVisible()
  expect(screen.queryByText('First frame in this tab')).not.toBeInTheDocument()
  expect(screen.queryByText('Not recorded yet')).not.toBeInTheDocument()
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
      viewerStartup={{ requestToConnectMs: 900, connectToFrameMs: 2200 }}
    />
  )
  expect(screen.getByText('+36.3 s')).toHaveAttribute('dateTime', new Date(at + 36340).toISOString())
  expect(screen.getByText('0.9 s')).toBeVisible()
  expect(screen.getByText('2.2 s')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Copy First frame in this tab' })).toBeInTheDocument()
})
