import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CreateAppGooglePlayGuidance } from './create-app-google-play-guidance'
import type { UploadedApk } from '@/server/orchestrator/applications/types'
import type { PlatformImage } from '@/shared/contracts/platform-image'

const image = (id: string, gmsMode: 'none' | 'gapps'): PlatformImage => ({
  id,
  shortId: id,
  repoTags: [`local/${id}:14`],
  repoDigests: [],
  sizeBytes: 1,
  sharedSizeBytes: 0,
  virtualSizeBytes: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  labels: {},
  managed: true,
  containers: 0,
  runtimeMetadataSource: 'stored',
  runtimeMetadata: {
    runtimeKind: 'redroid',
    androidVersion: '14',
    architecture: 'amd64',
    gmsMode,
    signatureSpoofing: 'not_applicable'
  }
})

const uploadedApk = {
  id: 'apk-1',
  googlePlayServices: {
    verdict: 'required',
    evidence: ['manifest_gms_version'],
    analysisVersion: 1
  }
} as UploadedApk

describe('CreateAppGooglePlayGuidance', () => {
  it('shows advisory text without unavailable actions', () => {
    render(
      <CreateAppGooglePlayGuidance
        uploadedApk={uploadedApk}
        images={[image('base', 'none')]}
        selectedImage='local/base:14'
        canChangeImage={false}
        canBuildImages={false}
        onUseImage={vi.fn()}
      />
    )

    expect(screen.getByText('Google Play services required')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('offers but does not automatically apply a recommended image', () => {
    const onUseImage = vi.fn()
    render(
      <CreateAppGooglePlayGuidance
        uploadedApk={uploadedApk}
        images={[image('base', 'none'), image('gapps', 'gapps')]}
        selectedImage='local/base:14'
        canChangeImage
        canBuildImages
        onUseImage={onUseImage}
      />
    )

    expect(onUseImage).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Use recommended image' }))
    expect(onUseImage).toHaveBeenCalledWith('local/gapps:14')
  })
})
