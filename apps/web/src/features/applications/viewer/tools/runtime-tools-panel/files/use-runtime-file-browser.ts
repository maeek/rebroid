'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'
import { getBff } from '@/lib/http/bff'
import {
  createApplicationRuntimeDirectoryAction,
  deleteApplicationRuntimeFileAction,
  downloadApplicationRuntimeFileAction,
  renameApplicationRuntimeFileAction
} from '@/server/orchestrator/applications/actions/runtime/file-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { downloadDataUrl, runtimeActionErrorToast } from '../runtime-tools-panel.utils'
import {
  filterAndSortRuntimeFiles,
  runtimeFilesRootPath,
  type RuntimeFileSort,
  type RuntimeFileSortDirection
} from './downloads-tools-section-model'
import type { ApplicationRuntimeFile } from '@/shared/contracts/application'

export const runtimeFilesQueryKey = (appId: string, path: string) => ['runtime-files', appId, path] as const

export const runtimeFilesUrl = (appId: string, path: string) => {
  const query = new URLSearchParams({ path })
  return `/api/bff/applications/${encodeURIComponent(appId)}/runtime/files?${query.toString()}`
}

export const useRuntimeFileBrowser = ({
  appId,
  canTransferFiles,
  runtimeAvailable
}: {
  appId: string
  canTransferFiles: boolean
  runtimeAvailable: boolean
}) => {
  const queryClient = useQueryClient()
  const [currentPath, setCurrentPath] = useState(runtimeFilesRootPath)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFile, setSelectedFile] = useState<ApplicationRuntimeFile | null>(null)
  const [sort, setSort] = useState<RuntimeFileSort>('name')
  const [sortDirection, setSortDirection] = useState<RuntimeFileSortDirection>('asc')

  useEffect(() => {
    setCurrentPath(runtimeFilesRootPath)
    setSearchQuery('')
    setSelectedFile(null)
  }, [appId])

  const filesQuery = useQuery<ApplicationRuntimeFile[], Error>({
    queryKey: runtimeFilesQueryKey(appId, currentPath),
    queryFn: ({ signal }) => getBff(runtimeFilesUrl(appId, currentPath), signal),
    enabled: runtimeAvailable && canTransferFiles,
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
        queryKey: runtimeFilesQueryKey(appId, path),
        queryFn: ({ signal }) => getBff<ApplicationRuntimeFile[]>(runtimeFilesUrl(appId, path), signal),
        staleTime: 10_000
      }),
    [appId, queryClient]
  )

  const updateParentCache = useCallback(
    (path: string, update: (files: ApplicationRuntimeFile[]) => ApplicationRuntimeFile[]) => {
      queryClient.setQueryData<ApplicationRuntimeFile[]>(runtimeFilesQueryKey(appId, path), current =>
        update(current ?? [])
      )
    },
    [appId, queryClient]
  )

  const createDirectory = useCallback(
    async (name: string) => {
      try {
        const created = unwrapActionResult(await createApplicationRuntimeDirectoryAction(appId, currentPath, name))
        updateParentCache(currentPath, current => [...current, created])
        toast({ title: 'Folder created', description: `${created.name} is available in ${currentPath}.` })
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
          void queryClient.invalidateQueries({ queryKey: ['runtime-files', appId] })
        }
        toast({ title: 'Item renamed', description: `${entry.name} is now ${renamed.name}.` })
        return true
      } catch (error) {
        runtimeActionErrorToast('Could not rename item', error)
        return false
      }
    },
    [appId, currentPath, queryClient, updateParentCache]
  )

  const deleteFile = useCallback(
    async (entry: ApplicationRuntimeFile) => {
      try {
        unwrapActionResult(await deleteApplicationRuntimeFileAction(appId, entry.path))
        updateParentCache(currentPath, current => current.filter(candidate => candidate.path !== entry.path))
        setSelectedFile(current => (current?.path === entry.path ? null : current))
        if (entry.type === 'directory') {
          void queryClient.invalidateQueries({ queryKey: ['runtime-files', appId] })
        }
        toast({ title: 'Item deleted', description: `${entry.name} was permanently deleted.` })
        return true
      } catch (error) {
        runtimeActionErrorToast('Could not delete item', error)
        return false
      }
    },
    [appId, currentPath, queryClient, updateParentCache]
  )

  const downloadFile = useCallback(
    async (entry: ApplicationRuntimeFile) => {
      try {
        const download = unwrapActionResult(await downloadApplicationRuntimeFileAction(appId, entry.path))
        downloadDataUrl(download.dataUrl, download.name)
      } catch (error) {
        runtimeActionErrorToast('Could not download file', error)
      }
    },
    [appId]
  )

  return {
    createDirectory,
    currentPath,
    deleteFile,
    downloadFile,
    error: filesQuery.error,
    files,
    hasLoadedFiles: filesQuery.data !== undefined,
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
    sortDirection,
    updateParentCache
  }
}
