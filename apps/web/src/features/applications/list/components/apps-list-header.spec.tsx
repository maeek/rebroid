import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppsListEmptyState } from './apps-list-empty-state'
import { AppsListHeader } from './apps-list-header'

describe('app creation affordances', () => {
  it('keeps creation available to authorized users', () => {
    render(<AppsListHeader canCreate />)
    expect(screen.getByRole('link', { name: 'Create app' })).toHaveAttribute('href', '/apps/create')
  })

  it('does not offer creation to users without permission', () => {
    render(<AppsListHeader canCreate={false} />)
    expect(screen.queryByRole('link', { name: 'Create app' })).toBeNull()
  })

  it('does not expose a creation link until permissions are known', () => {
    render(<AppsListHeader loading />)
    expect(screen.getByRole('button', { name: 'Create app' })).toBeDisabled()
    expect(screen.queryByRole('link', { name: 'Create app' })).toBeNull()
  })

  it('keeps restricted empty states free of unavailable actions', () => {
    render(<AppsListEmptyState canCreate={false} />)
    expect(screen.queryByRole('link', { name: 'Create app' })).toBeNull()
    expect(screen.getByText('No apps are available for your account.')).toBeVisible()
  })
})
