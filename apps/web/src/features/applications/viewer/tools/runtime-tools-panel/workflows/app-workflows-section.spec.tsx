import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { getBff } from '@/lib/http/bff'
import { AppWorkflowsSection } from './app-workflows-section'
import type { ApplicationWorkflowRun } from '@/shared/contracts/application-workflow-history'

vi.mock('next/navigation', async importOriginal => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/devices/external/device-id',
  useSearchParams: () => new URLSearchParams({ view: 'workflows', run: 'run-id' })
}))

vi.mock('@/lib/http/bff', () => ({ getBff: vi.fn() }))

const run: ApplicationWorkflowRun = {
  id: 'run-id',
  automationId: 'workflow-id',
  automationName: 'Check inventory',
  automationTriggerId: null,
  ownerUserId: 'owner-id',
  targetDeviceId: 'device-id',
  targetKind: 'external',
  targetProfileMode: null,
  targetProfileName: null,
  trigger: 'manual',
  status: 'success',
  startedAt: null,
  completedAt: null,
  createdAt: '2026-11-11T12:00:00Z',
  updatedAt: '2026-11-11T12:00:00Z',
  stepResults: [],
  error: null
}

it.each([true, false])('shows an external run with trace permission %s', async canViewFullTrace => {
  vi.mocked(getBff).mockResolvedValue(run)
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AppWorkflowsSection
        appId='device-id'
        canViewFullTrace={canViewFullTrace}
        launch={null}
      />
    </QueryClientProvider>
  )

  expect(await screen.findByRole('heading', { name: run.automationName! })).toBeVisible()
  const trace = screen.queryByRole('link', { name: 'Open full trace' })
  if (canViewFullTrace) expect(trace).toHaveAttribute('href', '/automations/workflow-id/traces?run=run-id')
  else expect(trace).not.toBeInTheDocument()
})
