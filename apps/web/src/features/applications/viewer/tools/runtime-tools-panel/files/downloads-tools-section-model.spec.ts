import { describe, expect, it } from 'vitest'
import {
  parentRuntimePath,
  runtimeFileEntryDetail,
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
    expect(runtimeItemLabel(null)).toBe('0 items')
    expect(runtimeItemLabel(1)).toBe('1 item')
    expect(runtimeItemLabel(2)).toBe('2 items')
    expect(runtimeFileEntryDetail(runtimeFile({ type: 'directory', itemCount: 3, sizeBytes: null }))).toBe('3 items')
    expect(runtimeFileEntryDetail(runtimeFile({ type: 'file', sizeBytes: 2048 }))).toBe('2.0 KB')
  })

  it('clamps top-loader upload progress to visible in-flight range', () => {
    expect(topLoaderProgressForUpload(0)).toBe(0.08)
    expect(topLoaderProgressForUpload(50)).toBe(0.5)
    expect(topLoaderProgressForUpload(100)).toBe(0.95)
  })
})
