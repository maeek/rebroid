import { describe, expect, it } from 'vitest'
import {
  filterAndSortRuntimeFiles,
  parentRuntimePath,
  runtimeFileCanPreview,
  runtimeFileEntryDetail,
  runtimeFileNameError,
  runtimeFilesRootPath,
  runtimeItemLabel,
  runtimePathForPartIndex,
  runtimePathParts,
  topLoaderProgressForUpload
} from './downloads-tools-section-model'
import type { ApplicationRuntimeFile } from '@/shared/contracts/application'

const runtimeFile = (override: Partial<ApplicationRuntimeFile>): ApplicationRuntimeFile => ({
  name: 'file.txt',
  path: '/data/file.txt',
  type: 'file',
  sizeBytes: 2048,
  modifiedAt: null,
  itemCount: null,
  ...override
})

describe('downloads tools section model', () => {
  it('builds runtime path breadcrumbs and parent paths', () => {
    expect(runtimeFilesRootPath).toBe('/data')
    expect(runtimePathParts('/data/downloads/screens')).toEqual(['data', 'downloads', 'screens'])
    expect(runtimePathForPartIndex(['data', 'downloads', 'screens'], 1)).toBe('/data/downloads')
    expect(parentRuntimePath('/data/downloads/screens')).toBe('/data/downloads')
    expect(parentRuntimePath('/data')).toBe('/data')
  })

  it('formats directory and file details', () => {
    expect(runtimeItemLabel(null)).toBe('Folder')
    expect(runtimeItemLabel(1)).toBe('1 item')
    expect(runtimeItemLabel(2)).toBe('2 items')
    expect(runtimeFileEntryDetail(runtimeFile({ type: 'directory', itemCount: 3, sizeBytes: null }))).toBe('3 items')
    expect(runtimeFileEntryDetail(runtimeFile({ type: 'directory', itemCount: null, sizeBytes: null }))).toBe('Folder')
    expect(runtimeFileEntryDetail(runtimeFile({ type: 'file', sizeBytes: 2048 }))).toBe('2.0 KB')
  })

  it('validates names before a create or rename request', () => {
    expect(runtimeFileNameError('Reports')).toBeNull()
    expect(runtimeFileNameError('../Reports')).toBe('Names cannot contain path separators.')
    expect(runtimeFileNameError('..')).toBe('Choose a different name.')
    expect(runtimeFileNameError('line\nbreak')).toBe('Names cannot contain control characters.')
  })

  it('filters by filename and sorts folders before files', () => {
    const files = [
      runtimeFile({ name: 'zeta.txt', path: '/data/zeta.txt', sizeBytes: 1 }),
      runtimeFile({ name: 'Alpha', path: '/data/Alpha', type: 'directory', sizeBytes: null }),
      runtimeFile({ name: 'ALPINE.png', path: '/data/ALPINE.png', sizeBytes: 5 })
    ]

    expect(
      filterAndSortRuntimeFiles({ files, query: 'alp', sort: 'name', direction: 'asc' }).map(file => file.name)
    ).toEqual(['Alpha', 'ALPINE.png'])
    expect(filterAndSortRuntimeFiles({ files, query: '', sort: 'size', direction: 'desc' })[0]?.name).toBe('Alpha')
  })

  it('only offers bounded image formats for preview', () => {
    expect(runtimeFileCanPreview(runtimeFile({ name: 'photo.JPEG' }))).toBe(true)
    expect(runtimeFileCanPreview(runtimeFile({ name: 'vector.svg' }))).toBe(false)
    expect(runtimeFileCanPreview(runtimeFile({ name: 'movie.mp4' }))).toBe(false)
  })

  it('clamps top-loader upload progress to visible in-flight range', () => {
    expect(topLoaderProgressForUpload(0)).toBe(0.08)
    expect(topLoaderProgressForUpload(50)).toBe(0.5)
    expect(topLoaderProgressForUpload(100)).toBe(0.95)
  })
})
