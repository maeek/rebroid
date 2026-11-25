import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { getBff } from '@/lib/http/bff'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { AppsList } from './apps-list'

vi.mock('next/navigation', async importOriginal => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams()
}))
vi.mock('@/lib/http/bff', () => ({ getBff: vi.fn() }))

afterEach(() => vi.useRealTimers())

const renderGallery = (orchestratorError?: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AppsList
        canCreate={false}
        canFilterByOwner={false}
        yourApps={[]}
        appsLoadedAt={Date.now()}
        currentOwnerUserId='owner-id'
        initialSettings={defaultOrchestratorUiSettings}
        orchestratorError={orchestratorError}
      />
    </QueryClientProvider>
  )

it('polls at the configured interval after using the server snapshot on mount', async () => {
  vi.useFakeTimers()
  vi.mocked(getBff).mockResolvedValue([])
  renderGallery()
  expect(getBff).not.toHaveBeenCalled()
  await act(() => vi.advanceTimersByTimeAsync(defaultOrchestratorUiSettings.appListRefreshIntervalSeconds * 1000))
  expect(getBff).toHaveBeenCalledWith('/api/bff/devices', expect.any(AbortSignal))
})

it('does not start a poll behind the server outage screen', () => {
  renderGallery('Unavailable')
  expect(screen.getByText('Orchestrator unavailable')).toBeVisible()
  expect(getBff).not.toHaveBeenCalled()
})
