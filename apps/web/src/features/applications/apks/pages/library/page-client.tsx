'use client'

import { useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { formatBytes } from '@/lib/format-bytes'
import { getBff, sendBff } from '@/lib/http/bff'
import { isApplicationId } from '@/shared/model/application-id'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridEmptyState } from '@/shared/ui/data-grid/data-grid-empty-state'
import { DataGridPagination } from '@/shared/ui/data-grid/data-grid-pagination'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { ApkLibraryPageLayout } from './library-page-layout'
import {
  availableBlockScopes,
  entryLabel,
  filterLibraryEntries,
  getActionExclusion,
  readLibraryFilter,
  statusFilters,
  usageFilters
} from './model/library-grid'
import { ApkLibraryActionDialog, type PendingLibraryAction } from './ui/library-action-dialog'
import { ApkLibraryBulkActions } from './ui/library-bulk-actions'
import { apkLibraryColumns } from './ui/library-columns'
import { ApkLibraryFilter } from './ui/library-filter'
import { ApkLibraryInspector } from './ui/library-inspector'
import type {
  ApkBlockScope,
  ApkLibraryAction,
  ApkLibraryData,
  ApkLibraryEntry,
  ApkLibraryMutationResult
} from '@/shared/contracts/apk-library'

const api = '/api/bff/apk-library'
const getRowId = (row: ApkLibraryEntry) => row.id
const replaceLibraryQuery = (params: URLSearchParams) => {
  const encoded = params.toString()
  if (encoded === window.location.search.slice(1)) return false
  window.history.replaceState(null, '', encoded ? `?${encoded}` : window.location.pathname)
  return true
}

export const ApkLibraryPageClient = ({
  initialData,
  loading = false
}: {
  initialData: ApkLibraryData
  loading?: boolean
}) => {
  const params = useSearchParams()
  const query = params.get('q') ?? ''
  const status = readLibraryFilter(params.get('status'), statusFilters, 'all')
  const usage = readLibraryFilter(params.get('usage'), usageFilters, 'all')
  const linkedAppId = params.get('app')
  const hasLinkedApp = isApplicationId(linkedAppId)
  const inspectedId = params.get('apk')
  const [data, setData] = useState(initialData)
  const [search, setSearch] = useState(query)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [action, setAction] = useState<PendingLibraryAction | null>(null)
  const [scope, setScope] = useState<ApkBlockScope>('sha256')
  const [reason, setReason] = useState('')
  const [working, setWorking] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [readError, setReadError] = useState<string>()
  const [actionError, setActionError] = useState<string>()
  const [result, setResult] = useState<{ message: string; details: string[] }>()
  const mutationLock = useRef(false)
  const filtered = filterLibraryEntries(data.entries, query, status, usage)
  const pageIndex = Math.min(page, Math.max(0, Math.ceil(filtered.length / pageSize) - 1))
  const rows = filtered.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)
  const selected = rows.filter(entry => selectedIds.has(entry.id))
  const canManage = data.canBlock || data.canDelete
  const busy = loading || working || refreshing
  const inspectedEntry = data.entries.find(entry => {
    if (inspectedId) return entry.id === inspectedId
    return hasLinkedApp && entry.apps.some(app => app.id === linkedAppId)
  })

  const updateFilters = (changes: Record<string, string>) => {
    const updated = new URLSearchParams(window.location.search)
    for (const [key, value] of Object.entries(changes)) {
      if (value && (key === 'q' || value !== 'all')) updated.set(key, value)
      else updated.delete(key)
    }
    if (!replaceLibraryQuery(updated)) return
    setPage(0)
    setSelectedIds(new Set())
  }

  const refresh = async () => {
    setRefreshing(true)
    try {
      setData(await getBff<ApkLibraryData>(api))
      setReadError(undefined)
    } catch (error) {
      setReadError(getDisplayErrorMessage(error, 'Could not refresh the APK library.'))
    } finally {
      setRefreshing(false)
    }
  }

  const closeInspector = () => {
    const updated = new URLSearchParams(window.location.search)
    updated.delete('app')
    updated.delete('apk')
    replaceLibraryQuery(updated)
  }

  const inspect = (entry: ApkLibraryEntry) => {
    const updated = new URLSearchParams(window.location.search)
    updated.delete('app')
    updated.set('apk', entry.id)
    replaceLibraryQuery(updated)
  }

  const openAction = (next: ApkLibraryAction, entries: ApkLibraryEntry[]) => {
    if (busy || readError || !entries.length) return
    setActionError(undefined)
    setResult(undefined)
    setReason('')
    setScope(next === 'delete' ? 'sha256' : (availableBlockScopes(entries, next)[0] ?? 'sha256'))
    setAction({ action: next, entries })
  }

  const runAction = async () => {
    if (!action || mutationLock.current) return
    const eligible = action.entries.filter(entry => !getActionExclusion(entry, action.action, scope))
    if (!eligible.length) return
    mutationLock.current = true
    setWorking(true)
    setActionError(undefined)
    try {
      const updated = await sendBff<ApkLibraryMutationResult>(api, {
        action: action.action,
        ids: eligible.map(entry => entry.id),
        scope: action.action === 'delete' ? undefined : scope,
        reason: action.action === 'block' ? reason.trim() : undefined
      })
      const changedIds = new Set(updated.changed)
      setSelectedIds(current => new Set([...current].filter(id => !changedIds.has(id))))
      const details = [
        ...action.entries.flatMap(entry => {
          const exclusion = getActionExclusion(entry, action.action, scope)
          return exclusion ? [`${entryLabel(entry)} · ${exclusion}`] : []
        }),
        ...updated.skipped.map(item => {
          const entry = action.entries.find(candidate => candidate.id === item.id)
          return `${entry ? entryLabel(entry) : 'APK'} · ${item.reason}`
        })
      ]
      const byPackage = action.action !== 'delete' && scope === 'package'
      const count = byPackage
        ? new Set(eligible.filter(entry => changedIds.has(entry.id)).map(entry => entry.packageName)).size
        : updated.changed.length
      const singular = byPackage ? 'package' : 'APK'
      const noun = count === 1 ? singular : `${singular}s`
      const message = {
        block: `${count} ${noun} blocked.`,
        unblock: `${count} ${noun} unblocked.`,
        delete: `${count} ${count === 1 ? 'file' : 'files'} deleted · ${formatBytes(updated.bytesFreed)} freed.`
      }[action.action]
      setResult({ message: details.length ? `${message} ${details.length} skipped.` : message, details })
      await refresh()
      setAction(null)
    } catch (error) {
      setActionError(getDisplayErrorMessage(error, 'The APK operation failed.'))
    } finally {
      mutationLock.current = false
      setWorking(false)
    }
  }

  return (
    <ApkLibraryPageLayout>
      <Section
        surface='plain'
        contentClassName='gap-4'
      >
        <DataGridWorkspace
          disabled={busy}
          search={search}
          appliedSearch={query}
          searchPlaceholder='Search APKs'
          onSearchChange={setSearch}
          onSearch={value => updateFilters({ q: value.trim() })}
          refresh={
            <PlatformPageRefreshButton
              label='Refresh APK library'
              disabled={loading || working}
              isRefreshing={refreshing}
              refreshResult={{ version: data, succeeded: !readError }}
              onRefresh={() => void refresh()}
            />
          }
          filters={
            <>
              <ApkLibraryFilter
                label='Status'
                value={status}
                options={statusFilters}
                onChange={value => updateFilters({ status: value })}
              />
              <ApkLibraryFilter
                label='Usage'
                value={usage}
                options={usageFilters}
                onChange={value => updateFilters({ usage: value })}
              />
            </>
          }
          filterTitle='Filter APKs'
          activeFilters={[
            ...(status === 'all'
              ? []
              : [
                  {
                    id: 'status',
                    label: 'Status',
                    value: statusFilters[status],
                    onRemove: () => updateFilters({ status: 'all' })
                  }
                ]),
            ...(usage === 'all'
              ? []
              : [
                  {
                    id: 'usage',
                    label: 'Usage',
                    value: usageFilters[usage],
                    onRemove: () => updateFilters({ usage: 'all' })
                  }
                ])
          ]}
          onResetFilters={() => updateFilters({ status: 'all', usage: 'all' })}
          selectedCount={selected.length}
          stickyMobileSelection
          bulkActions={
            canManage ? (
              <ApkLibraryBulkActions
                selected={selected}
                canBlock={data.canBlock && !readError}
                canDelete={data.canDelete && !readError}
                disabled={busy}
                onAction={next => openAction(next, selected)}
                clear={() => setSelectedIds(new Set())}
              />
            ) : null
          }
          notice={
            <>
              {readError ? (
                <Notice
                  tone='warning'
                  title={readError}
                />
              ) : null}
              {result ? (
                <Notice
                  tone={result.details.length ? 'warning' : 'success'}
                  title={result.message}
                >
                  {result.details.length ? (
                    <ul className='list-disc pl-4 [overflow-wrap:anywhere]'>
                      {result.details.map((detail, index) => (
                        <li key={`${index}:${detail}`}>{detail}</li>
                      ))}
                    </ul>
                  ) : null}
                </Notice>
              ) : null}
            </>
          }
        >
          <DataGrid
            loading={loading ? { selectable: true } : false}
            columns={apkLibraryColumns}
            data={rows}
            totalItems={filtered.length}
            pageIndex={pageIndex}
            pageSize={pageSize}
            getRowId={getRowId}
            selection={canManage ? { selectedIds, onSelectedIdsChange: setSelectedIds, disabled: busy } : undefined}
            rowActivation={{
              getLabel: entry => `Review ${entryLabel(entry)}`,
              onActivate: inspect
            }}
            emptyState={
              <DataGridEmptyState
                title='No APKs'
                description='Uploaded APKs appear here after inspection.'
              />
            }
          />
          <DataGridPagination
            loading={loading}
            totalItems={filtered.length}
            pageIndex={pageIndex}
            pageSize={pageSize}
            onPageIndexChange={value => {
              setSelectedIds(new Set())
              setPage(value)
            }}
            onPageSizeChange={value => {
              setSelectedIds(new Set())
              setPage(0)
              setPageSize(value)
            }}
          />
        </DataGridWorkspace>
      </Section>
      <ApkLibraryInspector
        entry={action ? null : (inspectedEntry ?? null)}
        close={closeInspector}
        canBlock={data.canBlock && !busy && !readError}
        canDelete={data.canDelete && !busy && !readError}
        onAction={openAction}
      />
      <ApkLibraryActionDialog
        pendingAction={action}
        entries={data.entries}
        scope={scope}
        reason={reason}
        pending={working}
        error={actionError}
        setScope={setScope}
        setReason={setReason}
        close={() => setAction(null)}
        confirm={() => void runAction()}
      />
    </ApkLibraryPageLayout>
  )
}
