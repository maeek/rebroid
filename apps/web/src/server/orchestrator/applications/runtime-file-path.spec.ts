import { expect, it } from 'vitest'
import { readRuntimeFilePath } from './runtime-file-path'

const request = (path?: string) =>
  new Request(`https://example.test/files?${new URLSearchParams(path === undefined ? {} : { path })}`)

it('defaults directory reads to the runtime data root and normalizes nested paths', () => {
  expect(readRuntimeFilePath(request(), 'directory')).toBe('/data')
  expect(readRuntimeFilePath(request('/data/media/'), 'directory')).toBe('/data/media')
  expect(readRuntimeFilePath(request('/data/media/./photo 1.png'), 'file')).toBe('/data/media/photo 1.png')
})

it.each([undefined, '', '/data', '/data/', '/database/item', '/photos/item'])(
  'requires a file inside the runtime data root (%s)',
  path => {
    expect(() => readRuntimeFilePath(request(path), 'file')).toThrow('Choose a file inside /data.')
  }
)
