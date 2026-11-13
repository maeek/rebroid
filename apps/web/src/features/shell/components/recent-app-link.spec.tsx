// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { requestApplicationStopAction } from '@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions'
import { actionOk } from '@/shared/actions/action-result'
import * as recentApps from '@/shared/model/recent-apps/recent-apps'
import { RecentAppLink } from './recent-app-link'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/hooks/use-open-app-as-me', () => ({
  useOpenAppAsMe: () => ({ isCloning: false, openAppAsMe: vi.fn() })
}))
vi.mock('@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions', () => ({
  requestApplicationStartAction: vi.fn(),
  requestApplicationStopAction: vi.fn()
}))
vi.mock('@/server/recent-apps/actions', () => ({ dismissRecentAppAction: vi.fn() }))

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
    expect(screen.getByRole('menuitem', { name: 'Open as me' })).toBeVisible()
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
