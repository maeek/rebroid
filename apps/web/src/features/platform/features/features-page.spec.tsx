import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { updateFeatureFlagsAction } from '@/server/orchestrator/settings/actions'
import { FeaturesPage, getEffectiveFeatureStatus } from './features-page'
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

  it('renders feature flags in the shared data grid workspace', () => {
    render(<FeaturesPage initialManifest={manifest} />)

    expect(screen.getByRole('searchbox', { name: 'Search features' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: /Feature/ })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: /Configuration/ })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: /Effective status/ })).toBeTruthy()
    expect(screen.getByText('Configuration revision 7')).toBeTruthy()
    expect(screen.getByRole('row', { name: /feature\.ocr/ })).toBeTruthy()
    expect(screen.getByRole('row', { name: /feature\.display-virtual/ })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Feature flags' })).toBeNull()
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

    expect(screen.queryByRole('row', { name: /feature\.ocr/ })).toBeNull()
    expect(screen.getByRole('row', { name: /feature\.display-virtual/ })).toBeTruthy()
  })

  it('updates a mutable feature from its table switch', async () => {
    const updatedManifest: FeatureFlagManifest = {
      revision: 8,
      features: [{ ...manifest.features[0], revision: 8, enabled: false, effective: false }]
    }
    vi.mocked(updateFeatureFlagsAction).mockResolvedValue(updatedManifest)

    render(<FeaturesPage initialManifest={{ ...manifest, features: [manifest.features[0]] }} />)

    fireEvent.click(screen.getByRole('switch', { name: 'Enable feature.ocr' }))

    expect(screen.getByLabelText('Applying feature.ocr')).toBeTruthy()

    await waitFor(() => {
      expect(updateFeatureFlagsAction).toHaveBeenCalledWith({
        revision: 7,
        changes: [{ key: 'feature.ocr', enabled: false }]
      })
    })
    expect(refresh).toHaveBeenCalledOnce()
    expect(screen.getByText('Configuration revision 8')).toBeTruthy()
  })
})
