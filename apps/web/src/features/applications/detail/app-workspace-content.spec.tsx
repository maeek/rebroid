import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fullPermissions } from '@/shared/permissions/permissions'
import { previewApp } from './app-resource-preview-data'
import { AppWorkspaceContent } from './app-workspace-content'
import { useApplicationViewerApp } from './application-viewer-context'

vi.mock('./application-viewer-context', () => ({ useApplicationViewerApp: vi.fn() }))
vi.mock('@/features/applications/viewer/actions/app-viewer-actions', () => ({ AppViewerActions: () => null }))
vi.mock('@/features/applications/viewer/tools/runtime-tools-panel/runtime-tools-panel', () => ({
  RuntimeToolsPanel: () => <div>Runtime content</div>
}))
describe('app tools workspace', () => {
  it('keeps Diagnostics and renders one tools panel at every viewport', () => {
    vi.mocked(useApplicationViewerApp).mockReturnValue({
      app: previewApp,
      permissions: fullPermissions,
      isForeignOwnedApp: false
    } as ReturnType<typeof useApplicationViewerApp>)
    render(<AppWorkspaceContent toolId='ai-agent' />)
    const navigation = within(screen.getByRole('navigation', { name: 'App sections' }))
    expect(navigation.getByRole('link', { name: 'Diagnostics' })).toHaveAttribute(
      'href',
      '/app/preview-app?view=diagnostics'
    )
    expect(screen.getAllByText('Runtime content')).toHaveLength(1)
    expect(screen.queryByRole('tablist')).toBeNull()
  })
})
