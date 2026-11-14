import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBff } from '@/lib/http/bff'
import { ActionResultError } from '@/shared/actions/action-result'
import { AppGalleryCard } from './app-gallery-card'
import type { AppGalleryCardData } from './app-gallery-tile'

vi.mock('@/lib/http/bff', () => ({ getBff: vi.fn() }))
vi.mock('@/hooks/use-open-app-as-me', () => ({
  useOpenAppAsMe: () => ({ isCloning: false, openAppAsMe: vi.fn() })
}))

const app: AppGalleryCardData = { id: 'app-id', name: 'Test app', status: 'running', canViewSnapshot: true }
const firstSnapshot = { dataUrl: 'data:image/webp;base64,AA==', capturedAt: '2026-11-13T10:00:00Z' }
const secondSnapshot = { dataUrl: 'data:image/webp;base64,BB==', capturedAt: '2026-11-13T10:01:00Z' }
const label = 'Latest screenshot of Test app'

const gallery = (client: QueryClient, current: AppGalleryCardData) => (
  <QueryClientProvider client={client}>
    <ul>
      <AppGalleryCard app={current} />
    </ul>
  </QueryClientProvider>
)

describe('app gallery snapshot', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.resetAllMocks()
  })

  it('fetches on focus only while the app is running and has snapshot access', async () => {
    vi.mocked(getBff).mockResolvedValue(firstSnapshot)
    const client = new QueryClient()
    const view = render(gallery(client, { ...app, canViewSnapshot: false }))
    const link = () => screen.getByRole('link', { name: 'Open Test app' })
    fireEvent.focus(link())
    expect(getBff).not.toHaveBeenCalled()
    view.rerender(gallery(client, app))
    expect(screen.queryByAltText(label)).toBeNull()
    expect(getBff).not.toHaveBeenCalled()
    fireEvent.focus(link())
    const preview = await screen.findByAltText(label)
    expect(preview).toHaveAttribute('src', firstSnapshot.dataUrl)
    expect(screen.queryByText(/Captured/)).toBeNull()
    expect(link()).not.toContainElement(preview)
    view.rerender(gallery(client, { ...app, status: 'stopped' }))
    expect(screen.queryByAltText(label)).toBeNull()
    expect(getBff).toHaveBeenCalledTimes(1)
  })

  it('refreshes every minute and clears the previous image when access is denied', async () => {
    vi.useFakeTimers()
    vi.mocked(getBff)
      .mockResolvedValueOnce(firstSnapshot)
      .mockResolvedValueOnce(secondSnapshot)
      .mockRejectedValueOnce(new ActionResultError({ code: 'forbidden', message: 'Forbidden', requestId: 'test' }))
    const client = new QueryClient()
    const view = render(gallery(client, app))
    try {
      fireEvent.focus(screen.getByRole('link', { name: 'Open Test app' }))
      await act(() => vi.advanceTimersByTimeAsync(400))
      expect(screen.getByAltText(label)).toHaveAttribute('src', firstSnapshot.dataUrl)
      await act(() => vi.advanceTimersByTimeAsync(60_000))
      expect(screen.getByAltText(label)).toHaveAttribute('src', secondSnapshot.dataUrl)
      expect(screen.queryByText(/Captured/)).toBeNull()
      await act(() => vi.advanceTimersByTimeAsync(60_000))
      expect(screen.queryByAltText(label)).toBeNull()
      expect(screen.getByText('Preview unavailable')).toBeVisible()
      expect(getBff).toHaveBeenCalledTimes(3)
    } finally {
      view.unmount()
    }
  })

  it('cancels an in-flight refresh when the app stops', async () => {
    vi.mocked(getBff).mockImplementation((_url, signal) => {
      return new Promise((_, reject) => {
        signal?.addEventListener('abort', () => reject(new Error('Snapshot request aborted')), { once: true })
      })
    })
    const client = new QueryClient()
    const view = render(gallery(client, app))
    fireEvent.focus(screen.getByRole('link', { name: 'Open Test app' }))
    await waitFor(() => expect(getBff).toHaveBeenCalledTimes(1))
    expect(screen.getByText('Loading preview…')).toBeVisible()
    const signal = vi.mocked(getBff).mock.calls[0][1]
    view.rerender(gallery(client, { ...app, status: 'stopped' }))
    expect(signal?.aborted).toBe(true)
  })
})
