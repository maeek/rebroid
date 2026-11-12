import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { listRunningApplicationNotificationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { NavigationNotifications } from './notifications'
import { navigationPopupPositions } from './popup-position'

vi.mock('@/server/orchestrator/applications/actions/queries/listing-actions', () => ({
  listRunningApplicationNotificationsAction: vi.fn()
}))

it('updates the closed navigation badge on each foreground poll, including after dismissal', async () => {
  vi.useFakeTimers()
  focusManager.setFocused(true)
  const queryClient = new QueryClient()
  const read = vi.mocked(listRunningApplicationNotificationsAction)
  read
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      {
        appId: 'app',
        appName: 'App',
        appIcon: null,
        appPackageName: 'com.example.app',
        notifications: [
          { packageName: 'com.example.app', title: 'New message', text: 'Hello', appName: null, raw: 'sample' }
        ]
      }
    ])
    .mockResolvedValue([])

  const view = render(
    <QueryClientProvider client={queryClient}>
      <NavigationNotifications
        popupPosition={navigationPopupPositions.sidebar}
        polling
      />
    </QueryClientProvider>
  )
  try {
    const badge = screen.getByRole('button', { name: 'Notifications', expanded: false })
    await act(() => vi.advanceTimersByTimeAsync(50))
    expect(badge).not.toHaveTextContent(/\d/)
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(badge).toHaveTextContent('1')
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(badge).not.toHaveTextContent('1')
    expect(read).toHaveBeenCalledTimes(3)
  } finally {
    view.unmount()
    queryClient.clear()
    focusManager.setFocused(undefined)
    vi.useRealTimers()
  }
})
