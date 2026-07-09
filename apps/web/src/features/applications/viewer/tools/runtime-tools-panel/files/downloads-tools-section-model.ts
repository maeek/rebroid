import { formatDateLocale } from '@/lib/format'
import { formatBytes } from '../runtime-tools-panel.utils'
import type { ApplicationRuntimeFile } from '@/server/orchestrator/applications/types'

export type BrowserView = 'list' | 'tiles'

export const runtimeFilesRootPath = '/data'

export const parentRuntimePath = (path: string) => path.slice(0, path.lastIndexOf('/')) || runtimeFilesRootPath

export const runtimePathParts = (path: string) => path.split('/').filter(Boolean)

export const runtimePathForPartIndex = (pathParts: string[], index: number) =>
  `/${pathParts.slice(0, index + 1).join('/')}`

export const runtimeItemLabel = (count: number | null) => `${count ?? 0} item${count === 1 ? '' : 's'}`

export const runtimeFileEntryDetail = (entry: ApplicationRuntimeFile) =>
  entry.type === 'directory' ? runtimeItemLabel(entry.itemCount) : formatBytes(entry.sizeBytes ?? 0)

export const runtimeFileEntrySubtitle = (entry: ApplicationRuntimeFile) => {
  const detail = runtimeFileEntryDetail(entry)
  return entry.modifiedAt ? `${detail} • ${formatDateLocale(entry.modifiedAt)}` : detail
}

export const topLoaderProgressForUpload = (progress: number) => Math.min(Math.max(progress / 100, 0.08), 0.95)
