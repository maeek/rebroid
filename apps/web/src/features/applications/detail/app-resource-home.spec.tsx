import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppResourceHome } from './app-resource-home'
import { previewApp } from './app-resource-preview-data'
import { useApplicationViewerApp } from './application-viewer-context'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

vi.mock('./application-viewer-context', () => ({ useApplicationViewerApp: vi.fn() }))
vi.mock('@/features/applications/viewer/actions/app-viewer-actions', () => ({ AppViewerActions: () => null }))
vi.mock('@/features/applications/viewer/logs/app-logs-content', () => ({
  AppLogsContent: () => <div>Diagnostic log content</div>
}))
vi.mock('@/features/applications/manage/app-manage-technical-details', () => ({
  AppManageTechnicalDetails: () => <div>Backend details</div>
}))
const app = {
  ...previewApp,
  id: 'app-1',
  name: 'Example app',
  status: 'error',
  running: false,
  lifecycleStage: 'error',
  statusDetail: { code: 'error', tone: 'error', title: 'Startup failed', description: 'Android did not boot.' },
  applicationError: {
    hint: 'Inspect boot output.',
    code: 'unknown',
    phase: 'provisioning',
    message: 'Boot failed.',
    retryable: true,
    exitCode: null
  },
  memoryLimitMb: null,
  cpuLimitCpus: null,
  profileMode: 'persistent',
  containerImage: 'redroid:test',
  recreateContainerOnNextStart: true
} satisfies AppDefinition

const setup = (permissions = {}, isForeignOwnedApp = false) => {
  vi.mocked(useApplicationViewerApp).mockReturnValue({ app, permissions, isForeignOwnedApp } as ReturnType<
    typeof useApplicationViewerApp
  >)
}
describe('AppResourceHome', () => {
  it('renders activity composed by the authorized page without owning the audit feature', () => {
    setup()
    render(
      <AppResourceHome
        view='activity'
        activity={<div>Scoped app audit grid</div>}
      />
    )
    expect(screen.getByText('Scoped app audit grid')).toBeVisible()
    expect(screen.queryByText('Activity unavailable')).toBeNull()
  })

  it('does not imply activity is available when the page supplies no authorized content', () => {
    setup()
    render(<AppResourceHome view='activity' />)
    expect(screen.getByText('Activity unavailable')).toBeVisible()
  })
  it('shows stored state and pending changes without exposing diagnostics to an unauthorized user', () => {
    setup()
    render(<AppResourceHome view='overview' />)
    expect(screen.getByText('Startup failed')).toBeTruthy()
    expect(screen.getByText('Configuration saved; runtime update pending')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Diagnostics' })).toBeNull()
    expect(screen.queryByText('Inspect boot output.')).toBeNull()
    expect(screen.getAllByText('Runtime default')).toHaveLength(2)
    expect(screen.queryByRole('link', { name: 'Open viewer' })).toBeNull()
  })
  it('offers a direct failure investigation path for permitted users', () => {
    setup({ 'applications:view-logs': true, 'applications:view-backend-details': true })
    render(<AppResourceHome view='diagnostics' />)
    expect(
      within(screen.getByRole('navigation', { name: 'App sections' })).getByRole('link', { name: 'Diagnostics' })
    ).toHaveAttribute('href', '/app/app-1?view=diagnostics')
    expect(screen.getByText('Inspect boot output.')).toBeTruthy()
    expect(screen.getByText('Diagnostic log content')).toBeTruthy()
  })
  it('keeps foreign-owned app logs and workspace inaccessible in administrator view', () => {
    setup({ 'applications:view-logs': true }, true)
    render(<AppResourceHome view='diagnostics' />)
    expect(screen.queryByText('Diagnostic log content')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Workspace' })).toBeNull()
    expect(screen.getByText('Diagnostics unavailable')).toBeTruthy()
  })
})
