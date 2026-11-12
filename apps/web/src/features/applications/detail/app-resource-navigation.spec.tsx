import type { ReactNode } from 'react'
import { render as renderWithProviders, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FeatureFlagsProvider } from '@/shared/model/features/feature-flags-context'
import { fullPermissions } from '@/shared/permissions/permissions'
import { AppResourceBreadcrumbs } from './app-resource-breadcrumbs'
import { AppResourceNavigation } from './app-resource-navigation'
import { appResourcePreviewFeatures } from './app-resource-preview-data'

const render = (node: ReactNode) =>
  renderWithProviders(node, {
    wrapper: ({ children }) => (
      <FeatureFlagsProvider manifest={appResourcePreviewFeatures}>{children}</FeatureFlagsProvider>
    )
  })

describe('app resource navigation', () => {
  it('shows audit activity only with administrator access, independently from runtime permissions', () => {
    const { rerender } = render(
      <AppResourceNavigation
        appId='app-1'
        active='overview'
        permissions={fullPermissions}
        isForeignOwnedApp={false}
      />
    )
    expect(screen.queryByRole('link', { name: 'Activity' })).toBeNull()
    rerender(
      <AppResourceNavigation
        appId='app-1'
        active='activity'
        permissions={{}}
        isForeignOwnedApp
        canViewAuditActivity
      />
    )
    expect(screen.getByRole('link', { name: 'Activity' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('link', { name: 'Network' })).toBeNull()
  })
  it('shows app sections in order and keeps Diagnostics in the same navigation as AI tools', () => {
    render(
      <AppResourceNavigation
        appId='app-1'
        active='ai-agent'
        permissions={fullPermissions}
        isForeignOwnedApp={false}
        canViewAuditActivity
      />
    )
    expect(screen.getAllByRole('link').map(link => link.textContent)).toEqual([
      'Overview',
      'AI agent',
      'Workflows',
      'Files',
      'Activity',
      'Diagnostics',
      'Configuration',
      'Network'
    ])
    expect(screen.getByRole('link', { name: 'Diagnostics' })).toHaveAttribute('href', '/app/app-1?view=diagnostics')
    expect(screen.getByRole('link', { name: 'AI agent' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Configuration' })).toHaveAttribute('href', '/app/app-1?view=configuration')
    expect(screen.getByRole('link', { name: 'Network' })).toHaveAttribute('href', '/app/app-1?view=network')
    expect(screen.queryByRole('link', { name: 'Workspace' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Streaming' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Clipboard' })).toBeNull()
  })
  it('does not offer runtime tools or private logs on a foreign app', () => {
    render(
      <AppResourceNavigation
        appId='app-1'
        active='overview'
        permissions={{ 'applications:view-logs': true, 'automations:run': true }}
        isForeignOwnedApp
      />
    )
    expect(screen.queryByRole('link', { name: 'Diagnostics' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Workflows' })).toBeNull()
  })
  it('uses section labels in breadcrumbs instead of Manage', () => {
    render(
      <AppResourceBreadcrumbs
        appId='app-1'
        appName='Example'
        view='profiles'
      />
    )
    expect(screen.getByRole('link', { name: 'Configuration' })).toHaveAttribute('href', '/app/app-1?view=configuration')
    expect(screen.getByText('Profiles')).toBeVisible()
    expect(screen.queryByText('Manage')).toBeNull()
  })
})
