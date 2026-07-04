import { describe, expect, it } from '@jest/globals'
import { localBuildContextFilesFromFileList } from './local-build-context-files'

const fileWithRelativePath = (name: string, relativePath: string) => {
  const file = new File(['content'], name)
  Object.defineProperty(file, 'webkitRelativePath', {
    configurable: true,
    value: relativePath
  })
  return file
}

describe('localBuildContextFilesFromFileList', () => {
  it('strips the selected directory name from folder input paths', () => {
    const selection = localBuildContextFilesFromFileList(
      [fileWithRelativePath('GmsCore.apk', 'context/apks/GmsCore.apk')],
      {
        fallbackRootLabel: 'Selected folder',
        useRelativePath: true
      }
    )

    expect(selection.label).toBe('context')
    expect(selection.files.map(file => file.contextPath)).toEqual(['apks/GmsCore.apk'])
  })

  it('keeps file input paths rooted at each selected filename', () => {
    const selection = localBuildContextFilesFromFileList([new File(['content'], 'GmsCore.apk')], {
      fallbackRootLabel: 'Selected files',
      useRelativePath: false
    })

    expect(selection.label).toBe('GmsCore.apk')
    expect(selection.files.map(file => file.contextPath)).toEqual(['GmsCore.apk'])
  })
})
