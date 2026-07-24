'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { UploadRequestError } from '@/lib/http/upload-form-data-with-progress'
import { uploadDownloadFileWithProgress } from './upload-download-file'
import { runtimeFilesQueryKey } from './use-runtime-file-browser'
import type { ApplicationRuntimeFile } from '@/shared/contracts/application'

export type RuntimeFileUploadStatus = 'canceled' | 'completed' | 'conflict' | 'failed' | 'queued' | 'uploading'

export interface RuntimeFileUploadItem {
  error?: string
  file: File
  id: string
  overwrite: boolean
  path: string
  progress: number
  status: RuntimeFileUploadStatus
}

const maximumConcurrentUploads = 2

export const useRuntimeFileUploads = (appId: string) => {
  const queryClient = useQueryClient()
  const [items, setItems] = useState<RuntimeFileUploadItem[]>([])
  const activeIdsRef = useRef(new Set<string>())
  const controllersRef = useRef(new Map<string, AbortController>())

  const updateItem = useCallback((id: string, update: Partial<RuntimeFileUploadItem>) => {
    setItems(current => current.map(item => (item.id === id ? { ...item, ...update } : item)))
  }, [])

  const runUpload = useCallback(
    (item: RuntimeFileUploadItem) => {
      if (activeIdsRef.current.has(item.id)) return
      activeIdsRef.current.add(item.id)
      const controller = new AbortController()
      controllersRef.current.set(item.id, controller)
      updateItem(item.id, { error: undefined, progress: 0, status: 'uploading' })
      void uploadDownloadFileWithProgress({
        appId,
        file: item.file,
        path: item.path,
        overwrite: item.overwrite,
        signal: controller.signal,
        onProgress: progress => updateItem(item.id, { progress })
      })
        .then(uploaded => {
          queryClient.setQueryData<ApplicationRuntimeFile[]>(runtimeFilesQueryKey(appId, item.path), current => {
            const remaining = (current ?? []).filter(entry => entry.path !== uploaded.path)
            return [...remaining, uploaded]
          })
          updateItem(item.id, { progress: 100, status: 'completed' })
        })
        .catch(error => {
          if (error instanceof DOMException && error.name === 'AbortError') {
            updateItem(item.id, { error: undefined, status: 'canceled' })
            return
          }
          if (error instanceof UploadRequestError && error.status === 409) {
            updateItem(item.id, { error: error.message, status: 'conflict' })
            return
          }
          updateItem(item.id, {
            error: error instanceof Error ? error.message : 'Upload failed.',
            status: 'failed'
          })
        })
        .finally(() => {
          activeIdsRef.current.delete(item.id)
          controllersRef.current.delete(item.id)
          setItems(current => [...current])
        })
    },
    [appId, queryClient, updateItem]
  )

  useEffect(() => {
    const available = maximumConcurrentUploads - activeIdsRef.current.size
    if (available <= 0) return
    items
      .filter(item => item.status === 'queued' && !activeIdsRef.current.has(item.id))
      .slice(0, available)
      .forEach(runUpload)
  }, [items, runUpload])

  useEffect(
    () => () => {
      controllersRef.current.forEach(controller => controller.abort())
    },
    []
  )

  const addFiles = useCallback((files: FileList | File[], path: string) => {
    const next = Array.from(files).map(file => ({
      file,
      id: crypto.randomUUID(),
      overwrite: false,
      path,
      progress: 0,
      status: 'queued' as const
    }))
    setItems(current => [...current, ...next])
  }, [])

  const cancel = useCallback(
    (id: string) => {
      const controller = controllersRef.current.get(id)
      if (controller) {
        controller.abort()
        return
      }
      updateItem(id, { status: 'canceled' })
    },
    [updateItem]
  )

  const dismiss = useCallback((id: string) => {
    setItems(current => current.filter(item => item.id !== id))
  }, [])

  const retry = useCallback(
    (id: string, overwrite = false) => {
      updateItem(id, { error: undefined, overwrite, progress: 0, status: 'queued' })
    },
    [updateItem]
  )

  const activeCount = useMemo(
    () => items.filter(item => item.status === 'queued' || item.status === 'uploading').length,
    [items]
  )

  return { activeCount, addFiles, cancel, dismiss, items, retry }
}
