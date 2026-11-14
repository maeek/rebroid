// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getBff } from '@/lib/http/bff'
import { requestApplicationStopAction } from '@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions'
import { actionOk } from '@/shared/actions/action-result'
import * as recentApps from '@/shared/model/recent-apps/recent-apps'
import { RecentAppLink } from './recent-app-link'
import type { NavigationVariant } from './protected-navigation-config'
import type { RecentApp } from '@/shared/contracts/recent-app'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/hooks/use-open-app-as-me', () => ({
  useOpenAppAsMe: () => ({ isCloning: false, openAppAsMe: vi.fn() })
}))
vi.mock('@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions', () => ({
  requestApplicationStartAction: vi.fn(),
  requestApplicationStopAction: vi.fn()
}))
vi.mock('@/server/recent-apps/actions', () => ({ dismissRecentAppAction: vi.fn() }))
vi.mock('@/lib/http/bff', () => ({ getBff: vi.fn() }))

const appStatuses = [
  ['running', 'Running', true],
  ['provisioning', 'Booting Android', true],
  ['removing', 'Removing', true],
  ['stopped', 'Stopping', true],
  ['stopped', 'Stopped', false],
  ['error', 'Error', false],
  ['removed', 'Removed', false]
] satisfies [RecentApp['status'], string, boolean][]

describe.each(['sidebar', 'rail', 'drawer'] satisfies NavigationVariant[])('%s app status', variant => {
  it.each(appStatuses)('renders the indicator for %s (%s) only when applicable', (status, statusLabel, visible) => {
    render(
      <ul>
        <RecentAppLink
          app={{ id: 'app-1', name: 'Test', openedAt: 1, status, statusLabel }}
          isActive={false}
          variant={variant}
          onStarted={() => undefined}
        />
      </ul>
    )
    if (visible) expect(screen.getByTitle(statusLabel)).toBeInTheDocument()
    else expect(screen.queryByTitle(statusLabel)).toBeNull()
  })
})

describe('recent app context menu', () => {
  it('highlights the targeted row until its menu closes without changing the current page', async () => {
    render(
      <ul>
        <RecentAppLink
          app={{
            id: 'app-1',
            name: 'Test',
            ownerDisplayName: 'Operations',
            openedAt: 1,
            status: 'stopped',
            canStop: true,
            canClone: true
          }}
          isActive={false}
          variant='sidebar'
          onStarted={() => undefined}
        />
      </ul>
    )
    const link = screen.getByRole('link', { name: 'Test · Operations' })
    const row = screen.getByRole('listitem')
    expect(row).not.toHaveClass('bg-accent')

    fireEvent.contextMenu(link, { clientX: 10, clientY: 10 })
    const menu = await screen.findByRole('menu')
    expect(row).toHaveClass('bg-accent')
    expect(link).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('menuitem', { name: 'Copy to my apps' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Remove from recent' })).toBeVisible()
    expect(screen.queryByRole('menuitem', { name: 'Start app' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Stop app…' })).not.toBeInTheDocument()

    fireEvent.keyDown(menu, { key: 'Escape' })
    expect(row).not.toHaveClass('bg-accent')
  })

  it('omits Stop for a running app without stop access', async () => {
    render(
      <ul>
        <RecentAppLink
          app={{ id: 'app-1', name: 'Test', openedAt: 1, status: 'running', canStop: false }}
          isActive={false}
          variant='sidebar'
          onStarted={() => undefined}
        />
      </ul>
    )

    fireEvent.contextMenu(screen.getByRole('link', { name: 'Test' }), { clientX: 10, clientY: 10 })
    await screen.findByRole('menu')

    expect(screen.queryByRole('menuitem', { name: 'Stop app…' })).not.toBeInTheDocument()
  })

  it('stops the targeted running app after confirmation and refreshes the sidebar', async () => {
    const stopAction = vi.mocked(requestApplicationStopAction)
    stopAction.mockResolvedValue(actionOk({ status: 'stopped', lifecycleStage: 'stopped', message: 'Stopped' }))
    const refresh = vi.spyOn(recentApps, 'notifyRecentAppsUpdated')
    const onNavigate = vi.fn()
    render(
      <ul>
        <RecentAppLink
          app={{ id: 'app-1', name: 'Test', openedAt: 1, status: 'running', canStop: true }}
          isActive={false}
          variant='sidebar'
          onNavigate={onNavigate}
          onStarted={() => undefined}
        />
      </ul>
    )

    fireEvent.contextMenu(screen.getByRole('link', { name: 'Test' }), { clientX: 10, clientY: 10 })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Stop app…' }))
    expect(await screen.findByRole('dialog', { name: 'Stop Test?' })).toBeVisible()
    expect(stopAction).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Stop app' }))

    await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
    expect(stopAction).toHaveBeenCalledExactlyOnceWith('app-1')
    expect(onNavigate).not.toHaveBeenCalled()
  })
})

it('loads an authorized sidebar snapshot on focus and closes it when the app stops', async () => {
  const fetchSnapshot = vi.mocked(getBff)
  fetchSnapshot.mockResolvedValue({ dataUrl: 'data:image/webp;base64,AA==' })
  const client = new QueryClient()
  const entry = (status: 'running' | 'stopped') => (
    <QueryClientProvider client={client}>
      <ul>
        <RecentAppLink
          app={{ id: 'app-1', name: 'Test', openedAt: 1, status, canViewSnapshot: true }}
          isActive={false}
          variant='sidebar'
          onStarted={() => undefined}
        />
      </ul>
    </QueryClientProvider>
  )
  const view = render(entry('running'))
  expect(fetchSnapshot).not.toHaveBeenCalled()
  fireEvent.focus(screen.getByRole('link', { name: 'Test' }))
  expect(await screen.findByAltText('Latest screenshot of Test')).toBeVisible()
  fireEvent.contextMenu(screen.getByRole('link', { name: 'Test' }), { clientX: 10, clientY: 10 })
  expect(await screen.findByRole('menu')).toBeVisible()
  expect(screen.queryByAltText('Latest screenshot of Test')).toBeNull()
  view.rerender(entry('stopped'))
  expect(screen.queryByAltText('Latest screenshot of Test')).toBeNull()
})
