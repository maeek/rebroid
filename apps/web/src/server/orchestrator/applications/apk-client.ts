import { emptyRequest, streamRequest } from '../request'
import type { UploadedApk } from './types'

export const orchestratorApkUploadsClient = {
  uploadApk(input: ReadableStream<Uint8Array>, ownerUserId: string, contentType: string, signal?: AbortSignal) {
    const query = new URLSearchParams({ ownerUserId })
    return streamRequest<UploadedApk>(`/apk-uploads?${query.toString()}`, 'POST', input, contentType, { signal })
  },

  listUploadedApks(ownerUserId?: string) {
    const query = ownerUserId ? `?${new URLSearchParams({ ownerUserId }).toString()}` : ''
    return emptyRequest<UploadedApk[]>(`/apk-uploads${query}`)
  },

  lookupUploadedApk(sha256: string, ownerUserId?: string) {
    const query = new URLSearchParams({
      sha256,
      ...(ownerUserId ? { ownerUserId } : {})
    })
    return emptyRequest<UploadedApk | null>(`/apk-uploads/lookup?${query.toString()}`)
  }
}
