import { emptyRequest, jsonRequest, streamRequest } from '../request'
import type { ApkLibraryEntry, ApkLibraryMutation, ApkLibraryMutationResult } from '@/shared/contracts/apk-library'
import type { UploadedApk } from '@/shared/contracts/application'

export const orchestratorApkUploadsClient = {
  uploadApk(input: ReadableStream<Uint8Array>, ownerUserId: string, contentType: string, signal?: AbortSignal) {
    const query = new URLSearchParams({ ownerUserId })
    return streamRequest<UploadedApk>(`/apk-uploads?${query.toString()}`, 'POST', input, contentType, { signal })
  },

  listUploadedApks(ownerUserId?: string) {
    const query = ownerUserId ? `?${new URLSearchParams({ ownerUserId }).toString()}` : ''
    return emptyRequest<UploadedApk[]>(`/apk-uploads${query}`)
  },

  listLibrary() {
    return emptyRequest<ApkLibraryEntry[]>('/apk-uploads/library')
  },

  getUploadedApk(id: string, ownerUserId: string) {
    const query = new URLSearchParams({ ownerUserId })
    return emptyRequest<UploadedApk>(`/apk-uploads/selection/${encodeURIComponent(id)}?${query}`)
  },

  mutateLibrary(input: ApkLibraryMutation) {
    return jsonRequest<ApkLibraryMutationResult>('/apk-uploads/library', 'POST', input)
  },

  lookupUploadedApk(sha256: string, ownerUserId?: string) {
    const query = new URLSearchParams({
      sha256,
      ...(ownerUserId ? { ownerUserId } : {})
    })
    return emptyRequest<UploadedApk | null>(`/apk-uploads/lookup?${query.toString()}`)
  }
}
