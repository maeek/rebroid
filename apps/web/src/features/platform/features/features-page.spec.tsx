import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { updateFeatureFlagsAction } from '@/server/orchestrator/settings/actions'
import { FeatureFlagsProvider } from '@/shared/model/features/feature-flags-context'
import { getEffectiveFeatureStatus } from './feature-status'
import { FeaturesPage, FeaturesPageLoading } from './features-page'
import type { FeatureFlagManifest } from '@/shared/contracts/feature-flags'

const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh })
}))

vi.mock('@/server/orchestrator/settings/actions', () => ({
  updateFeatureFlagsAction: vi.fn()
}))

type FeatureRow = FeatureFlagManifest['features'][number]

const createFeature = (overrides: Partial<FeatureRow> & Pick<FeatureRow, 'key'>): FeatureRow => ({
  owner: 'automations',
  revision: 7,
  description: 'Feature description.',
  control: 'runtime',
  mutable: true,
  enabled: true,
  supported: true,
  effective: true,
  syncStatus: 'applied',
  disablePolicy: 'block_new',
  lifecycle: 'permanent',
  removalCondition: null,
  dependencies: [],
  conflicts: [],
  ...overrides
})

const manifest: FeatureFlagManifest = {
  revision: 7,
  features: [
    createFeature({
      key: 'feature.ocr',
      description: 'OCR-backed automation perception.'
    }),
    createFeature({
      key: 'feature.display-virtual',
      owner: 'display',
      description: 'Experimental virtual display sessions.',
      control: 'deployment',
      mutable: false,
      enabled: false,
      effective: false,
      syncStatus: 'restart_required'
    })
  ]
}

describe('FeaturesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each(['ready', 'loading'] as const)('groups related features in the initial %s list', state => {
    const keys = [
      'feature.ocr',
      'feature.firewall',
      'feature.image-builder',
      'feature.display-virtual',
      'feature.ai',
      'feature.workflows',
      'feature.resource-quota',
      'feature.display-webrtc'
    ] as const
    const unorderedManifest = { ...manifest, features: keys.map(key => createFeature({ key })) }
    render(
      <FeatureFlagsProvider manifest={unorderedManifest}>
        {state === 'loading' ? <FeaturesPageLoading /> : <FeaturesPage initialManifest={unorderedManifest} />}
      </FeatureFlagsProvider>
    )

    expect(screen.getAllByTitle(/^feature\./).map(name => name.textContent)).toEqual([
      'Workflows',
      'AI',
      'OCR perception',
      'Virtual displays',
      'WebRTC streaming',
      'Image builder',
      'Firewall enforcement',
      'Resource quota'
    ])
  })

  it('keeps known feature metadata and row geometry while hiding unknown values during loading', () => {
    render(
      <FeatureFlagsProvider manifest={manifest}>
        <FeaturesPageLoading />
      </FeatureFlagsProvider>
    )
    expect(screen.getByText('OCR perception', { exact: true })).toBeVisible()
    expect(screen.getByText('Experimental virtual display sessions.')).toBeVisible()
    expect(screen.getAllByTestId('data-grid-skeleton-row')).toHaveLength(manifest.features.length)
    for (const name of ['Feature', 'Enabled', 'Availability', 'Manage'])
      expect(screen.getByRole('columnheader', { name })).toBeVisible()
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.getByRole('searchbox', { name: 'Search features' })).toBeDisabled()
    expect(screen.queryByText(/Configuration revision/)).toBeNull()
    expect(updateFeatureFlagsAction).not.toHaveBeenCalled()
  })

  it('renders feature flags in the shared data grid workspace', () => {
    render(<FeaturesPage initialManifest={manifest} />)

    expect(screen.getByRole('searchbox', { name: 'Search features' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: /Feature/ })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: /Enabled/ })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: /Availability/ })).toBeTruthy()
    expect(screen.queryByText(/Configuration revision/)).toBeNull()
    expect(screen.getByRole('row', { name: /OCR perception/ })).toBeTruthy()
    expect(screen.getByRole('row', { name: /Virtual displays/ })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Feature management', level: 1 })).toBeVisible()
    const breadcrumb = screen.getByRole('navigation', { name: 'breadcrumb' })
    expect(within(breadcrumb).getByText('Administration')).toBeVisible()
    expect(within(breadcrumb).getByText('Feature management')).toBeVisible()
    expect(within(breadcrumb).queryByRole('link', { name: 'Services' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Connection settings' })).toHaveAttribute('href', '/platform/ocr')
    expect(screen.getByRole('switch', { name: 'Enable Virtual displays' })).toHaveAttribute('aria-disabled', 'true')
  })

  it.each([
    [{ supported: false }, 'Unavailable'],
    [{ syncStatus: 'failed' }, 'Sync failed'],
    [{ syncStatus: 'restart_required' }, 'Restart required'],
    [{ owner: 'display', syncStatus: 'pending', effective: false }, 'Waiting for display service'],
    [{ enabled: false, effective: false }, 'Off'],
    [{ effective: true }, 'Active'],
    [{ effective: false, syncStatus: 'pending' }, 'Applying']
  ] as Array<[Partial<FeatureRow>, string]>)('maps effective status %o to %s', (overrides, label) => {
    expect(getEffectiveFeatureStatus(createFeature({ key: 'feature.ocr', ...overrides })).label).toBe(label)
  })

  it('filters the feature table from the shared search field', () => {
    render(<FeaturesPage initialManifest={manifest} />)

    const search = screen.getByRole('searchbox', { name: 'Search features' })
    fireEvent.change(search, { target: { value: 'virtual' } })
    fireEvent.keyDown(search, { key: 'Enter' })

    expect(screen.queryByRole('row', { name: /OCR perception/ })).toBeNull()
    expect(screen.getByRole('row', { name: /Virtual displays/ })).toBeTruthy()
  })

  it('preserves sorting by the requested enabled state', () => {
    render(<FeaturesPage initialManifest={manifest} />)
    fireEvent.click(screen.getByRole('button', { name: 'Enabled' }))
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('Virtual displays')
    fireEvent.click(screen.getByRole('button', { name: 'Enabled' }))
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('OCR perception')
  })

  it('updates a mutable feature from its table switch', async () => {
    const updatedManifest: FeatureFlagManifest = {
      revision: 8,
      features: [{ ...manifest.features[0], revision: 8, enabled: false, effective: false }]
    }
    vi.mocked(updateFeatureFlagsAction).mockResolvedValue(updatedManifest)

    render(<FeaturesPage initialManifest={{ ...manifest, features: [manifest.features[0]] }} />)

    fireEvent.click(screen.getByRole('switch', { name: 'Disable OCR perception' }))

    expect(screen.getByLabelText('Applying OCR perception')).toBeTruthy()

    await waitFor(() => {
      expect(updateFeatureFlagsAction).toHaveBeenCalledWith({
        revision: 7,
        changes: [{ key: 'feature.ocr', enabled: false }]
      })
    })
    expect(refresh).toHaveBeenCalledOnce()
    expect(screen.getByRole('switch', { name: 'Enable OCR perception' })).not.toBeChecked()
    expect(within(screen.getByRole('row', { name: /OCR perception/ })).queryByRole('link')).toBeNull()
    expect(screen.queryByText(/Configuration revision/)).toBeNull()
  })

  it('does not overwrite a completed toggle with an older refreshed manifest', async () => {
    vi.mocked(updateFeatureFlagsAction).mockResolvedValueOnce({
      revision: 8,
      features: [{ ...manifest.features[0], revision: 8, enabled: false, effective: false }]
    })
    const { rerender } = render(<FeaturesPage initialManifest={{ ...manifest, features: [manifest.features[0]] }} />)
    fireEvent.click(screen.getByRole('switch', { name: 'Disable OCR perception' }))
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Enable OCR perception' })).not.toBeChecked())
    rerender(<FeaturesPage initialManifest={structuredClone(manifest)} />)
    expect(screen.getByRole('switch', { name: 'Enable OCR perception' })).not.toBeChecked()
    vi.mocked(updateFeatureFlagsAction).mockResolvedValueOnce({
      revision: 9,
      features: [{ ...manifest.features[0], revision: 9 }]
    })
    fireEvent.click(screen.getByRole('switch', { name: 'Enable OCR perception' }))
    await waitFor(() =>
      expect(updateFeatureFlagsAction).toHaveBeenLastCalledWith({
        revision: 8,
        changes: [{ key: 'feature.ocr', enabled: true }]
      })
    )
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Disable OCR perception' })).toBeChecked())
  })

  it('hides links for unsupported features and keeps unsupported and deployment-managed switches read-only', () => {
    render(
      <FeaturesPage
        initialManifest={{
          ...manifest,
          features: [
            { ...manifest.features[0], supported: false, effective: false, enabled: false },
            manifest.features[1]
          ]
        }}
      />
    )
    fireEvent.click(screen.getByRole('switch', { name: 'Enable OCR perception' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Enable Virtual displays' }))
    expect(updateFeatureFlagsAction).not.toHaveBeenCalled()
    expect(screen.getByRole('switch', { name: 'Enable OCR perception' })).not.toBeChecked()
    const ocrRow = within(screen.getByRole('row', { name: /OCR perception/ }))
    expect(ocrRow.getByText('Unavailable', { exact: true })).toBeVisible()
    expect(ocrRow.queryByRole('link')).toBeNull()
    expect(screen.getByRole('link', { name: 'View sessions' })).toBeVisible()
  })

  it('keeps the requested value on failure and retries using a refreshed revision', async () => {
    vi.mocked(updateFeatureFlagsAction).mockRejectedValueOnce(new Error('Configuration changed'))
    const { rerender } = render(<FeaturesPage initialManifest={{ ...manifest, features: [manifest.features[0]] }} />)
    fireEvent.click(screen.getByRole('switch', { name: 'Disable OCR perception' }))
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
    expect(screen.getByRole('switch', { name: 'Disable OCR perception' })).toBeChecked()
    const fresh = { ...manifest, revision: 8, features: [{ ...manifest.features[0], revision: 8 }] }
    rerender(<FeaturesPage initialManifest={fresh} />)
    vi.mocked(updateFeatureFlagsAction).mockResolvedValue({
      ...fresh,
      revision: 9,
      features: [{ ...fresh.features[0], enabled: false, effective: false }]
    })
    fireEvent.click(screen.getByRole('switch', { name: 'Disable OCR perception' }))
    await waitFor(() =>
      expect(updateFeatureFlagsAction).toHaveBeenLastCalledWith({
        revision: 8,
        changes: [{ key: 'feature.ocr', enabled: false }]
      })
    )
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Enable OCR perception' })).not.toBeChecked())
  })
})
