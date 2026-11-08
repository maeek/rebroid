import { IconSettings } from '@tabler/icons-react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NestedNavigationMenu } from './protected-navigation-parts'

describe('administration navigation group', () => {
  it('uses the whole parent row to expand and marks only the active child as current', () => {
    const onToggle = vi.fn()
    render(
      <ul>
        <NestedNavigationMenu
          href='/platform/runtime'
          label='Platform settings'
          variant='sidebar'
          Icon={IconSettings}
          items={[{ name: 'Runtime defaults', href: '/platform/runtime', Icon: IconSettings }]}
          isOpen
          isActivePath={href => href === '/platform/runtime'}
          onToggle={onToggle}
        />
      </ul>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Platform settings menu' }))
    expect(onToggle).toHaveBeenCalledOnce()
    expect(screen.getByRole('link', { name: 'Runtime defaults' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('link', { name: 'Platform settings' })).toBeNull()
  })
})
