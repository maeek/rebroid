'use client'

import { useEffect, useMemo, useState } from 'react'
import { IconEye, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DataGrid, DataGridPagination, DataGridToolbar } from '@/components/data-grid'
import { Button } from '@/components/ui/button'
import { ContextMenuItem } from '@/components/ui/context-menu'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Section } from '@/components/ui/section'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { imageDisplayName } from '@/features/orchestrator/domain/image-display-name'
import { toast } from '@/hooks/use-toast'
import { formatUtcDate } from '@/lib/format'
import { removePlatformImageAction } from '@/server/orchestrator/platform/image-actions'
import { PlatformResourceScopeFilter } from './platform-resource-scope-filter'
import type {
  PlatformImage,
  PlatformImagesGridPage,
  PlatformImagesGridQuery
} from '@/server/orchestrator/platform/types'
import type { ColumnDef, SortingState } from '@tanstack/react-table'

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(2)} ${units[index]}`
}

const compactParams = (values: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    const text = String(value ?? '').trim()
    if (text && !(key === 'scope' && text === 'managed')) params.set(key, text)
  }
  return params
}

const sortToSearchParam = (sorting: SortingState) =>
  sorting.length === 0 ? undefined : sorting.map(item => `${item.id}:${item.desc ? 'desc' : 'asc'}`).join(',')

const sortFromSearchParam = (sort: string | undefined): SortingState =>
  (sort ?? 'createdAt:desc')
    .split(',')
    .map(part => {
      const [id, direction] = part.split(':')
      if (!id) return null
      return { id, desc: direction !== 'asc' }
    })
    .filter((item): item is SortingState[number] => Boolean(item))
    .slice(0, 3)

const ImageNameCell = ({ image }: { image: PlatformImage }) => {
  const name = imageDisplayName(image)
  const secondary = image.repoTags.length > 1 ? image.repoTags.slice(1).join(', ') : image.repoDigests[0]

  return (
    <div className='flex min-w-[18rem] flex-col gap-1'>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={`/infrastructure/images/${encodeURIComponent(image.id)}`}
            className='block truncate font-medium hover:text-primary'
          >
            {name}
          </Link>
        </TooltipTrigger>
        <TooltipContent className='max-w-sm break-all'>{name}</TooltipContent>
      </Tooltip>
      <div className='truncate text-xs text-muted-foreground'>{secondary || image.shortId}</div>
    </div>
  )
}

export const OrchestratorImagesSection = ({
  imagesPage,
  gridQuery,
  refreshKey = 0,
  onRefreshComplete
}: {
  imagesPage: PlatformImagesGridPage
  gridQuery: PlatformImagesGridQuery
  refreshKey?: number
  onRefreshComplete?: () => void
}) => {
  const router = useRouter()
  const [search, setSearch] = useState(gridQuery.q ?? '')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [pendingRemove, setPendingRemove] = useState<PlatformImage | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const sorting = useMemo(() => sortFromSearchParam(gridQuery.sort), [gridQuery.sort])

  useEffect(() => {
    setSearch(gridQuery.q ?? '')
  }, [gridQuery.q])

  useEffect(() => {
    const currentPageIds = new Set(imagesPage.items.map(image => image.id))
    setSelectedIds(current => new Set(Array.from(current).filter(id => currentPageIds.has(id))))
  }, [imagesPage.items])

  useEffect(() => {
    if (refreshKey > 0) {
      router.refresh()
      onRefreshComplete?.()
    }
  }, [onRefreshComplete, refreshKey, router])

  const selectedImages = imagesPage.items.filter(image => selectedIds.has(image.id))

  const pushGridParams = (patch: Partial<PlatformImagesGridQuery>) => {
    const params = compactParams({
      q: patch.q ?? gridQuery.q,
      scope: patch.scope ?? gridQuery.scope ?? 'managed',
      sort: patch.sort ?? gridQuery.sort,
      page: patch.page ?? gridQuery.page ?? 1,
      pageSize: patch.pageSize ?? gridQuery.pageSize ?? imagesPage.pageSize
    })
    router.push(`/infrastructure/images${params.size ? `?${params.toString()}` : ''}`)
  }

  const removeImage = async () => {
    if (!pendingRemove) return
    setBusyId(pendingRemove.id)
    try {
      await removePlatformImageAction(pendingRemove.id)
      toast({ title: 'Image removed' })
      setPendingRemove(null)
      router.refresh()
    } catch (caughtError) {
      toast({
        title: 'Could not remove image',
        description: caughtError instanceof Error ? caughtError.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusyId(null)
    }
  }

  const removeSelectedImages = async () => {
    if (selectedImages.length === 0) return
    setBusyId('bulk')
    try {
      const results = await Promise.allSettled(selectedImages.map(image => removePlatformImageAction(image.id)))
      const failedCount = results.filter(result => result.status === 'rejected').length
      setSelectedIds(new Set())
      router.refresh()
      toast(
        failedCount > 0
          ? {
              title: 'Some images could not be removed',
              description: `${failedCount} remove request failed.`,
              variant: 'destructive'
            }
          : { title: 'Selected images removed' }
      )
    } finally {
      setBusyId(null)
    }
  }

  const columns = useMemo<ColumnDef<PlatformImage>[]>(
    () => [
      {
        id: 'name',
        accessorFn: image => imageDisplayName(image),
        header: 'Image',
        size: 384,
        meta: { label: 'Image' },
        cell: ({ row }) => <ImageNameCell image={row.original} />
      },
      {
        id: 'sizeBytes',
        accessorFn: image => image.sizeBytes,
        header: 'Size',
        size: 144,
        meta: { label: 'Size' },
        cell: ({ row }) => (
          <span className='text-sm text-secondary-foreground'>{formatBytes(row.original.sizeBytes)}</span>
        )
      },
      {
        id: 'createdAt',
        accessorFn: image => image.createdAt,
        header: 'Created',
        size: 144,
        meta: { label: 'Created' },
        cell: ({ row }) => (
          <span className='text-sm text-secondary-foreground'>{formatUtcDate(row.original.createdAt)}</span>
        )
      },
      {
        id: 'containers',
        accessorFn: image => image.containers,
        header: 'Containers',
        size: 128,
        meta: { label: 'Containers' },
        cell: ({ row }) => (
          <span className='text-sm text-secondary-foreground'>
            {row.original.containers < 0 ? 'unknown' : row.original.containers}
          </span>
        )
      },
      {
        id: 'id',
        header: 'ID',
        size: 224,
        enableSorting: false,
        meta: { label: 'ID' },
        cell: ({ row }) => <span className='text-sm text-secondary-foreground'>{row.original.shortId}</span>
      }
    ],
    []
  )

  return (
    <>
      <Section contentClassName='gap-4'>
        <DataGridToolbar
          search={search}
          searchPlaceholder='Search images'
          onSearchChange={setSearch}
          onSearchSubmit={() => pushGridParams({ q: search.trim() || undefined, page: 1 })}
          activeFilterCount={gridQuery.scope === 'all' ? 1 : 0}
          selectedCount={selectedImages.length}
          filters={
            <PlatformResourceScopeFilter
              value={gridQuery.scope ?? 'managed'}
              onValueChange={scope => pushGridParams({ scope, page: 1 })}
            />
          }
          actions={
            <Button
              type='button'
              variant='ghost'
              disabled={busyId === 'bulk' || selectedImages.length === 0}
              onClick={() => void removeSelectedImages()}
            >
              Remove selected
            </Button>
          }
        />

        <TooltipProvider delayDuration={150}>
          <DataGrid
            columns={columns}
            data={imagesPage.items}
            totalItems={imagesPage.total}
            pageIndex={imagesPage.page - 1}
            pageSize={imagesPage.pageSize}
            getRowId={image => image.id}
            sorting={sorting}
            onSortingChange={updater => {
              const nextSorting = typeof updater === 'function' ? updater(sorting) : updater
              pushGridParams({ sort: sortToSearchParam(nextSorting), page: 1 })
            }}
            selection={{
              selectedIds,
              onSelectedIdsChange: setSelectedIds
            }}
            minWidth='72rem'
            emptyState={
              <div className='text-center text-secondary-foreground'>
                {gridQuery.q ? 'No images match this search.' : 'No images are visible to Docker.'}
              </div>
            }
            rowContextMenu={row => {
              const hasBulkSelection = selectedIds.has(row.original.id) && selectedImages.length > 1
              return (
                <>
                  {hasBulkSelection ? (
                    <ContextMenuItem
                      className='text-destructive focus:text-destructive'
                      disabled={busyId === 'bulk'}
                      onSelect={() => void removeSelectedImages()}
                    >
                      <IconTrash className='mr-2 size-4' />
                      Remove selected ({selectedImages.length})
                    </ContextMenuItem>
                  ) : null}
                  <ContextMenuItem asChild>
                    <Link href={`/infrastructure/images/${encodeURIComponent(row.original.id)}`}>
                      <IconEye className='mr-2 size-4' />
                      Details
                    </Link>
                  </ContextMenuItem>
                  <ContextMenuItem
                    className='text-destructive focus:text-destructive'
                    onSelect={() => setPendingRemove(row.original)}
                  >
                    <IconTrash className='mr-2 size-4' />
                    Remove
                  </ContextMenuItem>
                </>
              )
            }}
          />
        </TooltipProvider>
        <DataGridPagination
          totalItems={imagesPage.total}
          pageIndex={imagesPage.page - 1}
          pageSize={imagesPage.pageSize}
          onPageIndexChange={pageIndex => pushGridParams({ page: pageIndex + 1 })}
          onPageSizeChange={pageSize => pushGridParams({ page: 1, pageSize })}
        />
      </Section>

      <Dialog
        modal
        open={Boolean(pendingRemove)}
        onOpenChange={open => {
          if (!open) setPendingRemove(null)
        }}
      >
        <DialogContent className='sm:max-w-xl'>
          <DialogHeader>
            <DialogTitle>Remove image?</DialogTitle>
            <DialogDescription className='space-y-3'>
              <span className='block'>This removes the selected image from the container engine.</span>
              <span className='block rounded-md border border-border/60 bg-background/50 px-3 py-2 font-mono text-xs text-foreground break-all'>
                {pendingRemove ? imageDisplayName(pendingRemove) : 'the selected image'}
              </span>
              <span className='block'>
                Images used by containers may need cleanup or force removal from Docker directly.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='destructive'
              disabled={!pendingRemove || busyId === pendingRemove.id}
              onClick={() => void removeImage()}
            >
              Remove image
            </Button>
            <DialogClose asChild>
              <Button variant='secondary'>Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
