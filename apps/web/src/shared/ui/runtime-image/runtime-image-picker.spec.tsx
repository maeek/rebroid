import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RuntimeImagePicker } from './runtime-image-picker'
import type { PlatformImage } from '@/shared/contracts/platform'

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

const infrastructureImage = (): PlatformImage => ({
  ...image('orchestrator', 'none'),
  repoTags: ['localhost/rebroid/orchestrator:local'],
  runtimeMetadataSource: 'name',
  runtimeMetadata: {
    runtimeKind: 'generic',
    androidVersion: null,
    architecture: 'amd64',
    gmsMode: 'none',
    signatureSpoofing: 'not_applicable'
  }
})

describe('RuntimeImagePicker', () => {
  it('keeps choices closed until the combobox is opened', () => {
    const images = [image('base', 'none'), image('gapps', 'gapps')]
    render(
      <RuntimeImagePicker
        images={images}
        value='local/base:14'
        onChange={vi.fn()}
      />
    )

    expect(screen.queryByText('local/gapps:14')).toBeNull()
    fireEvent.click(screen.getByRole('combobox'))
    expect(screen.getByText('local/gapps:14')).toBeTruthy()
  })

  it('selects a row and reports the image reference', () => {
    const onChange = vi.fn()
    const images = [image('base', 'none'), image('gapps', 'gapps')]
    render(
      <RuntimeImagePicker
        images={images}
        value='local/base:14'
        onChange={onChange}
      />
    )

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: /local\/gapps:14/i }))
    expect(onChange).toHaveBeenCalledWith('local/gapps:14')
  })

  it('omits infrastructure images that are not registered runtimes', () => {
    render(
      <RuntimeImagePicker
        images={[image('base', 'none'), infrastructureImage()]}
        value='local/base:14'
        onChange={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('combobox'))

    expect(screen.getByRole('option', { name: /local\/base:14/i })).toBeTruthy()
    expect(screen.queryByText('localhost/rebroid/orchestrator:local')).toBeNull()
  })
})
