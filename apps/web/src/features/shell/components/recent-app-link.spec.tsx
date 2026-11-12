// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RecentAppLink } from './recent-app-link'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/hooks/use-open-app-as-me', () => ({
  useOpenAppAsMe: () => ({ isCloning: false, openAppAsMe: vi.fn() })
}))
vi.mock('@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions', () => ({
  requestApplicationStartAction: vi.fn()
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

    fireEvent.keyDown(menu, { key: 'Escape' })
    expect(row).not.toHaveClass('bg-accent')
  })
})
