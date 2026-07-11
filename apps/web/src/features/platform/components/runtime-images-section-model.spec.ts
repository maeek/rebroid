import { describe, expect, it } from 'vitest'
import {
  buildImagesGridHref,
  canRemoveSelectedImages,
  formatImageContainerCount,
  formatImageSize,
  getImageRemoveDialogLabel,
  getImageSecondaryLabel
} from './runtime-images-section-model'
import type { PlatformImage } from '@/shared/contracts/platform-image'

const image = (overrides: Partial<PlatformImage> = {}): PlatformImage =>
  ({
    id: 'sha256:image-1',
    shortId: 'abc123',
    repoTags: ['redroid:latest'],
    repoDigests: ['redroid@sha256:digest'],
    sizeBytes: 1024,
    createdAt: '2026-01-01T00:00:00.000Z',
    containers: 0,
    managed: true,
    ...overrides
  }) as PlatformImage

describe('orchestrator images section model', () => {
  it('builds compact image grid hrefs', () => {
    expect(
      buildImagesGridHref({
        gridQuery: { q: 'redroid', scope: 'managed', sort: 'createdAt:desc', page: 3, pageSize: 25 },
        pageSize: 25,
        patch: { q: 'base', page: 1 }
      })
    ).toBe('/runtime/images?q=base&sort=createdAt%3Adesc&page=1&pageSize=25')
  })

  it('allows bulk image removal only when at least one image is selected', () => {
    expect(canRemoveSelectedImages([])).toBe(false)
    expect(canRemoveSelectedImages([image()])).toBe(true)
  })

  it('formats image byte sizes with bounded units', () => {
    expect(formatImageSize(0)).toBe('0 B')
    expect(formatImageSize(1024)).toBe('1.00 KB')
    expect(formatImageSize(1536)).toBe('1.50 KB')
    expect(formatImageSize(1024 ** 5)).toBe('1024.00 TB')
  })

  it('chooses the image secondary label from extra tags, digest, then short id', () => {
    expect(getImageSecondaryLabel(image({ repoTags: ['redroid:latest', 'redroid:13'] }))).toBe('redroid:13')
    expect(getImageSecondaryLabel(image({ repoTags: ['redroid:latest'], repoDigests: ['digest'] }))).toBe('digest')
    expect(getImageSecondaryLabel(image({ repoTags: ['redroid:latest'], repoDigests: [] }))).toBe('abc123')
  })

  it('formats unknown container counts and remove dialog labels', () => {
    expect(formatImageContainerCount(-1)).toBe('unknown')
    expect(formatImageContainerCount(3)).toBe('3')
    expect(getImageRemoveDialogLabel(image())).toBe('redroid:latest')
    expect(getImageRemoveDialogLabel(null)).toBe('the selected image')
  })
})
