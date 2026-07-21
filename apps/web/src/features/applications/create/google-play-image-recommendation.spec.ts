import { describe, expect, it } from 'vitest'
import { recommendGooglePlayImage } from './google-play-image-recommendation'
import type { PlatformImage } from '@/shared/contracts/platform'

const image = ({
  id,
  androidVersion,
  architecture = 'amd64',
  gmsMode = 'gapps',
  createdAt = '2026-01-01T00:00:00.000Z'
}: {
  id: string
  androidVersion: string
  architecture?: string
  gmsMode?: 'none' | 'gapps'
  createdAt?: string
}): PlatformImage => ({
  id,
  shortId: id,
  repoTags: [`local/${id}:latest`],
  repoDigests: [],
  sizeBytes: 1,
  sharedSizeBytes: 0,
  virtualSizeBytes: 1,
  createdAt,
  labels: {},
  managed: true,
  containers: 0,
  runtimeMetadataSource: 'stored',
  runtimeMetadata: {
    runtimeKind: 'redroid',
    androidVersion,
    architecture,
    gmsMode,
    signatureSpoofing: 'not_applicable'
  }
})

describe('recommendGooglePlayImage', () => {
  it('prefers matching Android amd64 before Android 14 and 13 fallbacks', () => {
    const selected = image({ id: 'selected', androidVersion: '13', gmsMode: 'none' })
    const android14 = image({ id: 'gapps-14', androidVersion: '14' })
    const android13 = image({ id: 'gapps-13', androidVersion: '13' })

    expect(recommendGooglePlayImage([selected, android14, android13], 'local/selected:latest')?.id).toBe('gapps-13')
  })

  it('uses the newest image within the same recommendation tier', () => {
    const selected = image({ id: 'selected', androidVersion: '14', gmsMode: 'none' })
    const older = image({ id: 'older', androidVersion: '14' })
    const newer = image({ id: 'newer', androidVersion: '14', createdAt: '2026-02-01T00:00:00.000Z' })

    expect(recommendGooglePlayImage([selected, older, newer], 'local/selected:latest')?.id).toBe('newer')
  })
})
