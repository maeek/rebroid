import { z } from 'zod'
import { PublicActionError } from '@/server/errors/public-action-error'
import { emptyRequest, formRequest, jsonRequest, responseRequest, streamRequest } from '../request'
import { applicationPath, encodeApplicationPathSegment } from './application-path'
import type {
  ApplicationClipboard,
  ApplicationLog,
  ApplicationRuntimeFile,
  ApplicationRuntimeFileDownload,
  ApplicationRuntimeFilesProfileInput,
  ApplicationRuntimeFileUpload,
  ApplicationScreenshot,
  CreateApplicationRuntimeDirectoryInput,
  DeleteApplicationRuntimeFileResult,
  RenameApplicationRuntimeFileInput
} from '@/shared/contracts/application'

const logSourceSchema = z.enum(['orchestrator', 'container', 'adb'])
export type ApplicationLogSource = z.infer<typeof logSourceSchema>

export const orchestratorAppRuntimeClient = {
  getApplicationLogs(id: string, source: ApplicationLogSource, tail = 300) {
    const parsedSource = logSourceSchema.safeParse(source)
    if (!parsedSource.success) {
      throw new PublicActionError('Invalid application log source.', { code: 'validation', status: 400 })
    }
    const query = new URLSearchParams({ tail: String(tail) })
    return emptyRequest<ApplicationLog>(
      `${applicationPath(id)}/runtime/logs/${encodeURIComponent(parsedSource.data)}?${query.toString()}`
    )
  },

  listDownloadFiles(id: string, input: ApplicationRuntimeFilesProfileInput = {}) {
    const query = new URLSearchParams()
    if (input.profileMode) query.set('profileMode', input.profileMode)
    if (input.profileName) query.set('profileName', input.profileName)
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    return emptyRequest<ApplicationRuntimeFile[]>(`${applicationPath(id)}/runtime/download-files${suffix}`)
  },

  listFiles(id: string, path = '/data', signal?: AbortSignal) {
    const query = new URLSearchParams({ path })
    return emptyRequest<ApplicationRuntimeFile[]>(`${applicationPath(id)}/runtime/data-files?${query.toString()}`, {
      signal
    })
  },

  previewRuntimeFile(id: string, path: string, signal?: AbortSignal) {
    const query = new URLSearchParams({ path })
    return responseRequest(`${applicationPath(id)}/runtime/data-files/preview?${query.toString()}`, {
      headers: { accept: 'image/webp' },
      signal
    })
  },

  createRuntimeDirectory(id: string, input: CreateApplicationRuntimeDirectoryInput) {
    return jsonRequest<ApplicationRuntimeFile>(`${applicationPath(id)}/runtime/data-directories`, 'POST', input)
  },

  renameRuntimeFile(id: string, input: RenameApplicationRuntimeFileInput) {
    return jsonRequest<ApplicationRuntimeFile>(`${applicationPath(id)}/runtime/data-files`, 'PATCH', input)
  },

  deleteRuntimeFile(id: string, path: string) {
    const query = new URLSearchParams({ path })
    return emptyRequest<DeleteApplicationRuntimeFileResult>(
      `${applicationPath(id)}/runtime/data-files?${query.toString()}`,
      {
        method: 'DELETE'
      }
    )
  },

  downloadRuntimeFile(id: string, path: string) {
    const query = new URLSearchParams({ path })
    return emptyRequest<ApplicationRuntimeFileDownload>(
      `${applicationPath(id)}/runtime/data-files/download?${query.toString()}`
    )
  },

  uploadDownloadFile(id: string, input: FormData, profile: ApplicationRuntimeFilesProfileInput = {}) {
    const query = new URLSearchParams()
    if (profile.profileMode) query.set('profileMode', profile.profileMode)
    if (profile.profileName) query.set('profileName', profile.profileName)
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    return formRequest<ApplicationRuntimeFileUpload>(
      `${applicationPath(id)}/runtime/download-files${suffix}`,
      'POST',
      input
    )
  },

  uploadDataFileStream(
    id: string,
    input: ReadableStream<Uint8Array>,
    path: string,
    contentType: string,
    overwrite = false,
    signal?: AbortSignal
  ) {
    const query = new URLSearchParams({ path, overwrite: String(overwrite) })
    return streamRequest<ApplicationRuntimeFileUpload>(
      `${applicationPath(id)}/runtime/data-files?${query.toString()}`,
      'POST',
      input,
      contentType,
      { signal }
    )
  },

  downloadFile(id: string, fileName: string, input: ApplicationRuntimeFilesProfileInput = {}) {
    const query = new URLSearchParams()
    if (input.profileMode) query.set('profileMode', input.profileMode)
    if (input.profileName) query.set('profileName', input.profileName)
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    return emptyRequest<ApplicationRuntimeFileDownload>(
      `${applicationPath(id)}/runtime/download-files/${encodeApplicationPathSegment(fileName)}${suffix}`
    )
  },

  getClipboard(id: string) {
    return emptyRequest<ApplicationClipboard>(`${applicationPath(id)}/runtime/clipboard`)
  },

  setClipboard(id: string, text: string) {
    return jsonRequest<ApplicationClipboard>(`${applicationPath(id)}/runtime/clipboard`, 'PUT', { text })
  },

  captureScreenshot(id: string) {
    return emptyRequest<ApplicationScreenshot>(`${applicationPath(id)}/runtime/screenshot`, { method: 'POST' })
  }
}
