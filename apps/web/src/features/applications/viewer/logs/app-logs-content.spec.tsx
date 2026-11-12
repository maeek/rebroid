import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { previewApp } from '@/features/applications/detail/app-resource-preview-data'
import { getApplicationLogsAction } from '@/server/orchestrator/applications/actions/runtime/log-actions'
import { AppLogsContent } from './app-logs-content'

vi.mock('@/server/orchestrator/applications/actions/runtime/log-actions', () => ({ getApplicationLogsAction: vi.fn() }))

it('hides manual refresh during live updates and restores it when paused', async () => {
  vi.mocked(getApplicationLogsAction).mockResolvedValue({
    source: 'orchestrator',
    collectedAt: '2026-01-01T00:00:00Z',
    output: 'Application started'
  })
  const client = new QueryClient()
  render(
    <QueryClientProvider client={client}>
      <AppLogsContent app={previewApp} />
    </QueryClientProvider>
  )

  expect(await screen.findByText('Application started')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Refresh' })).toBeVisible()

  fireEvent.click(screen.getByRole('switch', { name: 'Live' }))
  expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Copy' })).toBeEnabled()

  fireEvent.click(screen.getByRole('switch', { name: 'Live' }))
  expect(screen.getByRole('button', { name: 'Refresh' })).toBeVisible()
})
