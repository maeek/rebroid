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

  it('links Docker to its overview and exposes a separate disclosure', () => {
    const onToggle = vi.fn()
    render(
      <ul>
        <NestedNavigationMenu
          label='Docker'
          href='/runtime/docker'
          variant='sidebar'
          Icon={IconSettings}
          items={[{ name: 'Containers', href: '/runtime/containers', Icon: IconSettings }]}
          isOpen
          isActivePath={href => href === '/runtime/docker'}
          onToggle={onToggle}
        />
      </ul>
    )

    const docker = screen.getByRole('link', { name: 'Docker' })
    expect(docker).toHaveAttribute('href', '/runtime/docker')
    expect(docker).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Containers' })).not.toHaveAttribute('aria-current')
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Docker menu', expanded: true }))
    expect(onToggle).toHaveBeenCalledOnce()
  })
})
