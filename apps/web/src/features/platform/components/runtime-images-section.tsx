'use client'

import { useEffect, useMemo, useState } from 'react'
import { IconEye, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { formatUtcDate } from '@/lib/format'
import { removePlatformImageAction } from '@/server/orchestrator/platform/image-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { imageDisplayName } from '@/shared/model/runtime-image/image-display-name'
import { DataGrid, DataGridPagination, DataGridToolbar } from '@/shared/ui/data-grid'
import { PlatformResourceScopeFilter } from './platform-resource-scope-filter'
import {
  platformSortFromSearchParam,
  platformSortToSearchParam,
  retainVisiblePlatformSelection,
  selectedPlatformItemsFromIds,
  summarizePlatformBulkRemoveResults
} from './runtime-grid-query-utils'
import { RuntimeImageBadges } from './runtime-image-badges'
import {
  buildImagesGridHref,
  canRemoveSelectedImages,
  formatImageContainerCount,
  formatImageSize,
  getImageRemoveDialogLabel,
  getImageSecondaryLabel
} from './runtime-images-section-model'
import type {
  PlatformImage,
  PlatformImagesGridPage,
  PlatformImagesGridQuery
} from '@/server/orchestrator/platform/types'
import type { ColumnDef } from '@tanstack/react-table'

const ImageNameCell = ({ image }: { image: PlatformImage }) => {
  const name = imageDisplayName(image)
  const secondary = getImageSecondaryLabel(image)

  return (
    <div className='flex min-w-[18rem] flex-col gap-1'>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={`/runtime/images/${encodeURIComponent(image.id)}`}
            className='block truncate font-medium hover:text-primary'
          >
            {name}
          </Link>
        </TooltipTrigger>
        <TooltipContent className='max-w-sm break-all'>{name}</TooltipContent>
      </Tooltip>
      <div className='truncate text-xs text-foreground-muted'>{secondary || image.shortId}</div>
      <RuntimeImageBadges image={image} />
    </div>
  )
}

export const createImageColumns = (): ColumnDef<PlatformImage>[] => [
  {
    id: 'name',
    accessorFn: image => imageDisplayName(image),
    header: 'Image',
    size: 384,
    meta: {
      label: 'Image',
      skeleton: {
        kind: 'custom',
        render: () => (
          <div className='grid gap-1'>
            <Skeleton className='h-5 w-[78%]' />
            <Skeleton className='h-4 w-[42%] opacity-70' />
            <div className='flex h-5 gap-1'>
              <Skeleton className='h-5 w-16 rounded-full' />
              <Skeleton className='h-5 w-20 rounded-full' />
            </div>
          </div>
        )
      }
    },
    cell: ({ row }) => <ImageNameCell image={row.original} />
  },
  {
    id: 'sizeBytes',
    accessorFn: image => image.sizeBytes,
    header: 'Size',
    size: 144,
    meta: { label: 'Size', skeleton: { kind: 'text', width: 'w-20' } },
    cell: ({ row }) => <span className='text-sm text-foreground-muted'>{formatImageSize(row.original.sizeBytes)}</span>
  },
  {
    id: 'createdAt',
    accessorFn: image => image.createdAt,
    header: 'Created',
    size: 144,
    meta: { label: 'Created', skeleton: { kind: 'text', width: 'w-24' } },
    cell: ({ row }) => <span className='text-sm text-foreground-muted'>{formatUtcDate(row.original.createdAt)}</span>
  },
  {
    id: 'containers',
    accessorFn: image => image.containers,
    header: 'Containers',
    size: 128,
    meta: { label: 'Containers', skeleton: { kind: 'text', width: 'w-12' } },
    cell: ({ row }) => (
      <span className='text-sm text-foreground-muted'>{formatImageContainerCount(row.original.containers)}</span>
    )
  },
  {
    id: 'id',
    header: 'ID',
    size: 224,
    enableSorting: false,
    meta: { label: 'ID', skeleton: { kind: 'text', width: 'w-28' } },
    cell: ({ row }) => <span className='text-sm text-foreground-muted'>{row.original.shortId}</span>
  }
]

export const RuntimeImagesSection = ({
  imagesPage,
  gridQuery
}: {
  imagesPage: PlatformImagesGridPage
  gridQuery: PlatformImagesGridQuery
}) => {
  const router = useRouter()
  const [search, setSearch] = useState(gridQuery.q ?? '')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [pendingRemove, setPendingRemove] = useState<PlatformImage | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const sorting = useMemo(
    () => platformSortFromSearchParam(gridQuery.sort, { defaultSort: 'createdAt:desc', missingDirection: 'desc' }),
    [gridQuery.sort]
  )

  useEffect(() => {
    setSearch(gridQuery.q ?? '')
  }, [gridQuery.q])

  useEffect(() => {
    setSelectedIds(current => retainVisiblePlatformSelection(imagesPage.items, current))
  }, [imagesPage.items])

  const selectedImages = selectedPlatformItemsFromIds(imagesPage.items, selectedIds)

  const pushGridParams = (patch: Partial<PlatformImagesGridQuery>) => {
    router.push(buildImagesGridHref({ gridQuery, pageSize: imagesPage.pageSize, patch }))
  }

  const removeImage = async () => {
    if (!pendingRemove) return
    setBusyId(pendingRemove.id)
    try {
      unwrapActionResult(await removePlatformImageAction(pendingRemove.id))
      toast({ title: 'Image removed' })
      setPendingRemove(null)
      router.refresh()
    } catch (caughtError) {
      toast({
        title: 'Could not remove image',
        description: getDisplayErrorMessage(caughtError),
        variant: 'danger'
      })
    } finally {
      setBusyId(null)
    }
  }

  const removeSelectedImages = async () => {
    if (selectedImages.length === 0) return
    setBusyId('bulk')
    try {
      const results = await Promise.all(selectedImages.map(image => removePlatformImageAction(image.id)))
      setSelectedIds(new Set())
      router.refresh()
      toast(summarizePlatformBulkRemoveResults(results, 'image'))
    } finally {
      setBusyId(null)
    }
  }

  const columns = useMemo(() => createImageColumns(), [])

  return (
    <>
      <Section
        surface='plain'
        contentClassName='gap-4'
      >
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
              disabled={busyId === 'bulk' || !canRemoveSelectedImages(selectedImages)}
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
              pushGridParams({ sort: platformSortToSearchParam(nextSorting), page: 1 })
            }}
            selection={{
              selectedIds,
              onSelectedIdsChange: setSelectedIds
            }}
            emptyState={
              <div className='text-center text-foreground-muted'>
                {gridQuery.q ? 'No images match this search.' : 'No images are visible to Docker.'}
              </div>
            }
            rowContextMenu={row => {
              const hasBulkSelection = selectedIds.has(row.original.id) && selectedImages.length > 1
              return (
                <>
                  {hasBulkSelection ? (
                    <ContextMenuItem
                      className='text-danger focus:text-danger'
                      disabled={busyId === 'bulk'}
                      onSelect={() => void removeSelectedImages()}
                    >
                      <IconTrash className='mr-2 size-4' />
                      Remove selected ({selectedImages.length})
                    </ContextMenuItem>
                  ) : null}
                  <ContextMenuItem asChild>
                    <Link href={`/runtime/images/${encodeURIComponent(row.original.id)}`}>
                      <IconEye className='mr-2 size-4' />
                      Details
                    </Link>
                  </ContextMenuItem>
                  <ContextMenuItem
                    className='text-danger focus:text-danger'
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
              <span className='block rounded-control border border-surface-border/60 bg-surface-band/60 px-3 py-2 font-mono text-xs text-foreground break-all'>
                {getImageRemoveDialogLabel(pendingRemove)}
              </span>
              <span className='block'>
                Images used by containers may need cleanup or force removal from Docker directly.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='danger'
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
