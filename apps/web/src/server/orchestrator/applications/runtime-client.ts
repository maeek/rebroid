import { emptyRequest, formRequest, jsonRequest, responseRequest, streamRequest } from '../request'
import type {
  AndroidNotification,
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

export const orchestratorAppRuntimeClient = {
  getNotifications(id: string) {
    return emptyRequest<AndroidNotification[]>(`/apps/${id}/runtime/notifications`)
  },

  getApplicationLogs(id: string, source: 'orchestrator' | 'container' | 'adb', tail = 300) {
    const query = new URLSearchParams({ tail: String(tail) })
    return emptyRequest<ApplicationLog>(`/apps/${id}/runtime/logs/${source}?${query.toString()}`)
  },

  listDownloadFiles(id: string, input: ApplicationRuntimeFilesProfileInput = {}) {
    const query = new URLSearchParams()
    if (input.profileMode) query.set('profileMode', input.profileMode)
    if (input.profileName) query.set('profileName', input.profileName)
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    return emptyRequest<ApplicationRuntimeFile[]>(`/apps/${id}/runtime/download-files${suffix}`)
  },

  listFiles(id: string, path = '/data', signal?: AbortSignal) {
    const query = new URLSearchParams({ path })
    return emptyRequest<ApplicationRuntimeFile[]>(`/apps/${id}/runtime/data-files?${query.toString()}`, { signal })
  },

  previewRuntimeFile(id: string, path: string, signal?: AbortSignal) {
    const query = new URLSearchParams({ path })
    return responseRequest(`/apps/${id}/runtime/data-files/preview?${query.toString()}`, {
      headers: { accept: 'image/webp' },
      signal
    })
  },

  createRuntimeDirectory(id: string, input: CreateApplicationRuntimeDirectoryInput) {
    return jsonRequest<ApplicationRuntimeFile>(`/apps/${id}/runtime/data-directories`, 'POST', input)
  },

  renameRuntimeFile(id: string, input: RenameApplicationRuntimeFileInput) {
    return jsonRequest<ApplicationRuntimeFile>(`/apps/${id}/runtime/data-files`, 'PATCH', input)
  },

  deleteRuntimeFile(id: string, path: string) {
    const query = new URLSearchParams({ path })
    return emptyRequest<DeleteApplicationRuntimeFileResult>(`/apps/${id}/runtime/data-files?${query.toString()}`, {
      method: 'DELETE'
    })
  },

  downloadRuntimeFile(id: string, path: string) {
    const query = new URLSearchParams({ path })
    return emptyRequest<ApplicationRuntimeFileDownload>(`/apps/${id}/runtime/data-files/download?${query.toString()}`)
  },

  uploadDownloadFile(id: string, input: FormData, profile: ApplicationRuntimeFilesProfileInput = {}) {
    const query = new URLSearchParams()
    if (profile.profileMode) query.set('profileMode', profile.profileMode)
    if (profile.profileName) query.set('profileName', profile.profileName)
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    return formRequest<ApplicationRuntimeFileUpload>(`/apps/${id}/runtime/download-files${suffix}`, 'POST', input)
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
      `/apps/${encodeURIComponent(id)}/runtime/data-files?${query.toString()}`,
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
      `/apps/${id}/runtime/download-files/${encodeURIComponent(fileName)}${suffix}`
    )
  },

  getClipboard(id: string) {
    return emptyRequest<ApplicationClipboard>(`/apps/${id}/runtime/clipboard`)
  },

  setClipboard(id: string, text: string) {
    return jsonRequest<ApplicationClipboard>(`/apps/${id}/runtime/clipboard`, 'PUT', { text })
  },

  captureScreenshot(id: string) {
    return emptyRequest<ApplicationScreenshot>(`/apps/${id}/runtime/screenshot`, { method: 'POST' })
  }
}
