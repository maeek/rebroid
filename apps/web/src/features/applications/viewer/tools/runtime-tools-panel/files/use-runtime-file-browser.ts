'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'
import { getBff } from '@/lib/http/bff'
import {
  createApplicationRuntimeDirectoryAction,
  deleteApplicationRuntimeFileAction,
  renameApplicationRuntimeFileAction
} from '@/server/orchestrator/applications/actions/runtime/file-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { downloadDataUrl, runtimeActionErrorToast } from '../runtime-tools-panel.utils'
import {
  filterAndSortRuntimeFiles,
  runtimeDownloadsPath,
  type RuntimeFileSort,
  type RuntimeFileSortDirection
} from './downloads-tools-section-model'
import type { ApplicationRuntimeFile, ApplicationRuntimeFileDownload } from '@/shared/contracts/application'

export const runtimeFilesQueryKey = (scope: string, path: string) => ['runtime-files', scope, path] as const

export const runtimeFilesUrl = (appId: string, path: string) => {
  const query = new URLSearchParams({ path })
  return `/api/bff/applications/${encodeURIComponent(appId)}/runtime/files?${query.toString()}`
}

export const useRuntimeFileBrowser = (appId: string, scope: string) => {
  const queryClient = useQueryClient()
  const [currentPath, setCurrentPath] = useState(runtimeDownloadsPath)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFile, setSelectedFile] = useState<ApplicationRuntimeFile | null>(null)
  const [sort, setSort] = useState<RuntimeFileSort>('name')
  const [sortDirection, setSortDirection] = useState<RuntimeFileSortDirection>('asc')
  const inFlightDownloads = useRef(new Map<string, string>())
  const [pendingDownloads, setPendingDownloads] = useState(() => new Map<string, string>())

  const filesQuery = useQuery<ApplicationRuntimeFile[], Error>({
    queryKey: runtimeFilesQueryKey(scope, currentPath),
    queryFn: ({ signal }) => getBff(runtimeFilesUrl(appId, currentPath), signal),
    gcTime: 5 * 60 * 1000,
    staleTime: 10_000,
    retry: 1
  })

  const files = useMemo(
    () =>
      filterAndSortRuntimeFiles({
        files: filesQuery.data ?? [],
        query: searchQuery,
        sort,
        direction: sortDirection
      }),
    [filesQuery.data, searchQuery, sort, sortDirection]
  )

  const navigateTo = useCallback((path: string) => {
    setCurrentPath(path)
    setSearchQuery('')
    setSelectedFile(null)
  }, [])

  const prefetchPath = useCallback(
    (path: string) =>
      queryClient.prefetchQuery({
        queryKey: runtimeFilesQueryKey(scope, path),
        queryFn: ({ signal }) => getBff<ApplicationRuntimeFile[]>(runtimeFilesUrl(appId, path), signal),
        staleTime: 10_000
      }),
    [appId, scope, queryClient]
  )

  const updateParentCache = useCallback(
    (path: string, update: (files: ApplicationRuntimeFile[]) => ApplicationRuntimeFile[]) => {
      queryClient.setQueryData<ApplicationRuntimeFile[]>(runtimeFilesQueryKey(scope, path), current =>
        update(current ?? [])
      )
    },
    [scope, queryClient]
  )

  const createDirectory = useCallback(
    async (name: string) => {
      try {
        const created = unwrapActionResult(await createApplicationRuntimeDirectoryAction(appId, currentPath, name))
        updateParentCache(currentPath, current => [...current, created])
        toast({
          title: 'Folder created',
          description: `${created.name} is available in ${currentPath}.`,
          variant: 'success'
        })
        return true
      } catch (error) {
        runtimeActionErrorToast('Could not create folder', error)
        return false
      }
    },
    [appId, currentPath, updateParentCache]
  )

  const renameFile = useCallback(
    async (entry: ApplicationRuntimeFile, name: string) => {
      try {
        const renamed = unwrapActionResult(await renameApplicationRuntimeFileAction(appId, entry.path, name))
        updateParentCache(currentPath, current =>
          current.map(candidate => (candidate.path === entry.path ? renamed : candidate))
        )
        setSelectedFile(current => (current?.path === entry.path ? renamed : current))
        if (entry.type === 'directory') {
          void queryClient.invalidateQueries({ queryKey: ['runtime-files', scope] })
        }
        toast({ title: 'Item renamed', description: `${entry.name} is now ${renamed.name}.` })
        return renamed
      } catch (error) {
        runtimeActionErrorToast('Could not rename item', error)
        return null
      }
    },
    [appId, scope, currentPath, queryClient, updateParentCache]
  )

  const deleteFile = useCallback(
    async (entry: ApplicationRuntimeFile) => {
      try {
        unwrapActionResult(await deleteApplicationRuntimeFileAction(appId, entry.path))
        updateParentCache(currentPath, current => current.filter(candidate => candidate.path !== entry.path))
        setSelectedFile(current => (current?.path === entry.path ? null : current))
        if (entry.type === 'directory') {
          void queryClient.invalidateQueries({ queryKey: ['runtime-files', scope] })
        }
        toast({
          title: 'Item deleted',
          description: `${entry.name} was permanently deleted.`,
          variant: 'success'
        })
        return true
      } catch (error) {
        runtimeActionErrorToast('Could not delete item', error)
        return false
      }
    },
    [appId, scope, currentPath, queryClient, updateParentCache]
  )

  const downloadFile = useCallback(
    async (entry: ApplicationRuntimeFile) => {
      if (entry.type !== 'file') return
      const key = entry.path
      const inFlight = inFlightDownloads.current
      if (inFlight.has(key)) return
      inFlight.set(key, entry.name)
      setPendingDownloads(new Map(inFlight))
      try {
        const query = new URLSearchParams({ path: entry.path })
        const download = await getBff<ApplicationRuntimeFileDownload>(
          `/api/bff/applications/${encodeURIComponent(appId)}/runtime/files/download?${query.toString()}`
        )
        downloadDataUrl(download.dataUrl, download.name)
      } catch (error) {
        runtimeActionErrorToast('Could not download file', error)
      } finally {
        inFlight.delete(key)
        setPendingDownloads(new Map(inFlight))
      }
    },
    [appId]
  )
  const isDownloading = useCallback((path: string) => pendingDownloads.has(path), [pendingDownloads])

  return {
    createDirectory,
    currentPath,
    deleteFile,
    downloadFile,
    error: filesQuery.error,
    files,
    hasLoadedFiles: filesQuery.data !== undefined,
    isDownloading,
    downloadingNames: [...pendingDownloads.values()],
    isLoading: filesQuery.isLoading,
    isRefreshing: filesQuery.isFetching && filesQuery.data !== undefined,
    navigateTo,
    prefetchPath,
    refresh: filesQuery.refetch,
    renameFile,
    searchQuery,
    selectedFile,
    setSearchQuery,
    setSelectedFile,
    setSort,
    setSortDirection,
    sort,
    sortDirection
  }
}
