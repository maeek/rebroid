import { normalizeBuildContextPath, type LocalBuildContextFile } from './dockerfile-context'

interface BrowserFileHandle {
  kind: 'file'
  name: string
  getFile: () => Promise<File>
}

interface BrowserDirectoryHandle {
  kind: 'directory'
  name: string
  entries: () => AsyncIterable<[string, BrowserFileHandle | BrowserDirectoryHandle]>
}

interface WindowWithDirectoryPicker extends Window {
  showDirectoryPicker?: () => Promise<BrowserDirectoryHandle>
}

export interface LocalBuildContextSelection {
  files: LocalBuildContextFile[]
  label: string
}

export const supportsDirectoryPicker = () =>
  typeof window !== 'undefined' && typeof (window as WindowWithDirectoryPicker).showDirectoryPicker === 'function'

export const readDirectoryWithPicker = async (): Promise<LocalBuildContextSelection> => {
  const pickerWindow = window as WindowWithDirectoryPicker
  if (!pickerWindow.showDirectoryPicker) {
    throw new Error('Directory picker is not available.')
  }

  const handle = await pickerWindow.showDirectoryPicker()
  const files = await readDirectoryHandle(handle)
  return { files, label: handle.name || 'Local folder' }
}

export const localBuildContextFilesFromFileList = (
  fileList: FileList | File[],
  options: { fallbackRootLabel: string; useRelativePath: boolean }
): LocalBuildContextSelection => {
  const files = Array.from(fileList)
  const contextFiles = files.flatMap(file => {
    const contextPath = normalizeSelectedFilePath(file, options.useRelativePath)
    return contextPath ? [{ contextPath, file }] : []
  })

  return { files: contextFiles, label: labelFromFiles(files, options.fallbackRootLabel, options.useRelativePath) }
}

const readDirectoryHandle = async (
  directory: BrowserDirectoryHandle,
  segments: string[] = []
): Promise<LocalBuildContextFile[]> => {
  const files: LocalBuildContextFile[] = []
  for await (const [name, handle] of directory.entries()) {
    if (handle.kind === 'file') {
      const contextPath = normalizeBuildContextPath([...segments, name].join('/'))
      if (!contextPath) {
        continue
      }
      files.push({ contextPath, file: await handle.getFile() })
      continue
    }

    files.push(...(await readDirectoryHandle(handle, [...segments, name])))
  }
  return files
}

const normalizeSelectedFilePath = (file: File, useRelativePath: boolean) => {
  const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath
  if (!useRelativePath || !relativePath) {
    return normalizeBuildContextPath(file.name)
  }

  const [, ...contextSegments] = relativePath.replace(/\\/g, '/').split('/')
  return normalizeBuildContextPath(contextSegments.length > 0 ? contextSegments.join('/') : file.name)
}

const labelFromFiles = (files: File[], fallback: string, useRelativePath: boolean) => {
  if (!useRelativePath) {
    return files.length === 1 ? files[0].name : fallback
  }

  const firstRelativePath = (files[0] as (File & { webkitRelativePath?: string }) | undefined)?.webkitRelativePath
  return firstRelativePath?.split('/')[0] || fallback
}
