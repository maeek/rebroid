import type { ReactNode } from 'react'
import { render as renderWithProviders, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FeatureFlagsProvider } from '@/shared/model/features/feature-flags-context'
import { AppResourceHome } from './app-resource-home'
import { appResourcePreviewFeatures, previewApp } from './app-resource-preview-data'
import { useApplicationViewerApp } from './application-viewer-context'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

vi.mock('./application-viewer-context', () => ({ useApplicationViewerApp: vi.fn() }))
vi.mock('@/features/applications/viewer/actions/app-viewer-actions', () => ({ AppViewerActions: () => null }))
vi.mock('@/features/applications/viewer/diagnostics/app-startup-timings', () => ({
  AppStartupTimings: () => <div>Startup timings</div>
}))
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

const setup = (permissions = {}, isForeignOwnedApp = false, application: AppDefinition = app) => {
  vi.mocked(useApplicationViewerApp).mockReturnValue({ app: application, permissions, isForeignOwnedApp } as ReturnType<
    typeof useApplicationViewerApp
  >)
}
const render = (node: ReactNode) =>
  renderWithProviders(node, {
    wrapper: ({ children }) => (
      <FeatureFlagsProvider manifest={appResourcePreviewFeatures}>{children}</FeatureFlagsProvider>
    )
  })

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
    expect(screen.getByText('Runtime update pending')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Diagnostics' })).toBeNull()
    expect(screen.queryByText('Inspect boot output.')).toBeNull()
    expect(screen.getAllByText('Runtime default')).toHaveLength(2)
    expect(screen.queryByRole('link', { name: 'Open viewer' })).toBeNull()
  })
  it.each([true, false])('gates the attached APK link on review permission (%s)', canReview => {
    const id = '6d8b5e09-e4bf-4568-9aa9-0572237c04d3'
    setup({ 'apks:review': canReview }, false, {
      ...app,
      id,
      uploadedApkId: 'd1492403-93fd-441e-8c2c-de7d84d7da32',
      apkOriginalName: 'stockroom.apk'
    })
    render(<AppResourceHome view='overview' />)
    const link = screen.queryByRole('link', { name: 'stockroom.apk' })
    if (canReview) {
      expect(link).toHaveAttribute('href', `/platform/apks?app=${id}`)
    } else {
      expect(link).toBeNull()
      expect(screen.getByText('stockroom.apk')).toBeVisible()
    }
  })
  it('leaves a steady lifecycle state in the heading without repeating it in a notice', () => {
    vi.mocked(useApplicationViewerApp).mockReturnValue({
      app: {
        ...app,
        status: 'running',
        running: true,
        lifecycleStage: 'ready',
        statusDetail: { ...app.statusDetail, title: 'Running', description: 'Android is ready.' },
        recreateContainerOnNextStart: false
      },
      permissions: {},
      isForeignOwnedApp: false
    } as ReturnType<typeof useApplicationViewerApp>)
    render(<AppResourceHome view='overview' />)
    expect(screen.getByText('Running', { exact: true })).toBeVisible()
    expect(screen.queryByText('Android is ready.')).toBeNull()
  })
  it('offers a direct failure investigation path for permitted users', () => {
    setup({ 'applications:view-logs': true, 'applications:view-backend-details': true })
    render(<AppResourceHome view='diagnostics' />)
    expect(
      within(screen.getByRole('navigation', { name: 'App sections' })).getByRole('link', { name: 'Diagnostics' })
    ).toHaveAttribute('href', '/app/app-1?view=diagnostics')
    expect(screen.getByText('Inspect boot output.')).toBeTruthy()
    expect(screen.getByText('Diagnostic log content')).toBeTruthy()
    const startupTimings = screen.getByText('Startup timings')
    expect(startupTimings).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Application logs' }).compareDocumentPosition(startupTimings)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
  })
  it('keeps foreign-owned app logs and workspace inaccessible in administrator view', () => {
    setup({ 'applications:view-logs': true }, true)
    render(<AppResourceHome view='diagnostics' />)
    expect(screen.queryByText('Diagnostic log content')).toBeNull()
    expect(screen.queryByText('Startup timings')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Workspace' })).toBeNull()
    expect(screen.getByText('Diagnostics unavailable')).toBeTruthy()
  })
})
