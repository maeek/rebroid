import { formatDateLocale } from '@/lib/format'
import { formatBytes } from '../runtime-tools-panel.utils'
import type { ApplicationRuntimeFile } from '@/shared/contracts/application'

export type RuntimeFileSort = 'modified' | 'name' | 'size'
export type RuntimeFileSortDirection = 'asc' | 'desc'

export const runtimeFilesRootPath = '/data'

export const runtimeFileLocations = [
  { label: 'Data', path: '/data' },
  { label: 'Internal storage', path: '/data/media/0' },
  { label: 'Download', path: '/data/media/0/Download' },
  { label: 'Pictures', path: '/data/media/0/Pictures' },
  { label: 'Movies', path: '/data/media/0/Movies' },
  { label: 'DCIM', path: '/data/media/0/DCIM' },
  { label: 'Documents', path: '/data/media/0/Documents' }
] as const

export const parentRuntimePath = (path: string) => path.slice(0, path.lastIndexOf('/')) || runtimeFilesRootPath

export const runtimePathParts = (path: string) => path.split('/').filter(Boolean)

export const runtimePathForPartIndex = (pathParts: string[], index: number) =>
  `/${pathParts.slice(0, index + 1).join('/')}`

export const runtimeItemLabel = (count: number | null) =>
  count === null ? 'Folder' : `${count} item${count === 1 ? '' : 's'}`

export const runtimeFileNameError = (value: string) => {
  const name = value.trim()
  const hasControlCharacter = [...name].some(character => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint <= 31 || codePoint === 127
  })
  if (!name) return 'Enter a name.'
  if (name === '.' || name === '..') return 'Choose a different name.'
  if (name.includes('/') || name.includes('\\')) return 'Names cannot contain path separators.'
  if (hasControlCharacter) return 'Names cannot contain control characters.'
  if (name.length > 255) return 'Names cannot exceed 255 characters.'
  return null
}

export const runtimeFileEntryDetail = (entry: ApplicationRuntimeFile) => {
  if (entry.type !== 'directory') return formatBytes(entry.sizeBytes ?? 0)
  return entry.itemCount === null ? 'Folder' : runtimeItemLabel(entry.itemCount)
}

export const runtimeFileEntrySubtitle = (entry: ApplicationRuntimeFile) => {
  const detail = runtimeFileEntryDetail(entry)
  return entry.modifiedAt ? `${detail} • ${formatDateLocale(entry.modifiedAt)}` : detail
}

export const topLoaderProgressForUpload = (progress: number) => Math.min(Math.max(progress / 100, 0.08), 0.95)

const imageExtensions = new Set(['gif', 'jpeg', 'jpg', 'png', 'webp'])

export const runtimeFileCanPreview = (entry: ApplicationRuntimeFile) => {
  if (entry.type !== 'file') return false
  const extension = entry.name.split('.').pop()?.toLowerCase()
  return extension ? imageExtensions.has(extension) : false
}

const compareNullable = (left: number | string | null, right: number | string | null) => {
  if (left === right) return 0
  if (left === null) return -1
  if (right === null) return 1
  return typeof left === 'number' && typeof right === 'number'
    ? left - right
    : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' })
}

export const filterAndSortRuntimeFiles = ({
  files,
  query,
  sort,
  direction
}: {
  files: ApplicationRuntimeFile[]
  query: string
  sort: RuntimeFileSort
  direction: RuntimeFileSortDirection
}) => {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  return files
    .filter(file => !normalizedQuery || file.name.toLocaleLowerCase().includes(normalizedQuery))
    .toSorted((left, right) => {
      if (left.type !== right.type) return left.type === 'directory' ? -1 : 1
      let comparison = 0
      if (sort === 'size') comparison = compareNullable(left.sizeBytes, right.sizeBytes)
      else if (sort === 'modified') comparison = compareNullable(left.modifiedAt, right.modifiedAt)
      else comparison = compareNullable(left.name, right.name)
      if (comparison === 0) comparison = compareNullable(left.name, right.name)
      return direction === 'asc' ? comparison : -comparison
    })
}
