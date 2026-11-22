'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ActionResultError } from '@/shared/actions/action-result'
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

export const useRuntimeFileUploads = (appId: string, scope: string) => {
  const queryClient = useQueryClient()
  const [items, setItems] = useState<RuntimeFileUploadItem[]>([])
  const controllersRef = useRef(new Map<string, AbortController>())

  const updateItem = useCallback((id: string, update: Partial<RuntimeFileUploadItem>) => {
    setItems(current => current.map(item => (item.id === id ? { ...item, ...update } : item)))
  }, [])

  const runUpload = useCallback(
    (item: RuntimeFileUploadItem) => {
      if (controllersRef.current.has(item.id)) return
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
          queryClient.setQueryData<ApplicationRuntimeFile[]>(runtimeFilesQueryKey(scope, item.path), current => {
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
          if (error instanceof ActionResultError && error.failure.code === 'runtime_file_exists') {
            updateItem(item.id, { error: error.message, status: 'conflict' })
            return
          }
          updateItem(item.id, {
            error: error instanceof Error ? error.message : 'Upload failed.',
            status: 'failed'
          })
        })
        .finally(() => {
          controllersRef.current.delete(item.id)
          setItems(current => [...current])
        })
    },
    [appId, scope, queryClient, updateItem]
  )

  useEffect(() => {
    const available = maximumConcurrentUploads - controllersRef.current.size
    if (available <= 0) return
    items
      .filter(item => item.status === 'queued' && !controllersRef.current.has(item.id))
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
