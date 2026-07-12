'use client'

import { useEffect, useMemo, useState } from 'react'
import { IconEye, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { formatUtcDate } from '@/lib/format'
import { removePlatformImageAction } from '@/server/orchestrator/platform/image-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { imageDisplayName } from '@/shared/model/runtime-image/image-display-name'
import { DataGrid, DataGridPagination, DataGridWorkspace } from '@/shared/ui/data-grid'
import { RuntimeImageFilters } from './runtime-grid-filter-controls'
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
  const [pendingRemove, setPendingRemove] = useState<PlatformImage[] | null>(null)
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
    router.replace(buildImagesGridHref({ gridQuery, pageSize: imagesPage.pageSize, patch }), { scroll: false })
  }

  const removeImages = async () => {
    if (!pendingRemove?.length) return
    setBusyId(pendingRemove.length === 1 ? pendingRemove[0].id : 'bulk')
    try {
      const results = await Promise.all(pendingRemove.map(image => removePlatformImageAction(image.id)))
      if (pendingRemove.length === 1) {
        unwrapActionResult(results[0])
        toast({ title: 'Image removed', variant: 'success' })
      } else {
        toast(summarizePlatformBulkRemoveResults(results, 'image'))
        setSelectedIds(new Set())
      }
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

  const columns = useMemo(() => createImageColumns(), [])
  const activeFilters = [
    ...(gridQuery.ownership === 'all'
      ? [
          {
            id: 'ownership',
            label: 'Ownership',
            value: 'All Docker',
            onRemove: () => pushGridParams({ ownership: 'managed', page: 1 })
          }
        ]
      : []),
    ...(gridQuery.usage && gridQuery.usage !== 'all'
      ? [
          {
            id: 'usage',
            label: 'Usage',
            value: gridQuery.usage,
            onRemove: () => pushGridParams({ usage: 'all', page: 1 })
          }
        ]
      : []),
    ...(gridQuery.runtimeKind && gridQuery.runtimeKind !== 'all'
      ? [
          {
            id: 'runtimeKind',
            label: 'Runtime',
            value: gridQuery.runtimeKind,
            onRemove: () => pushGridParams({ runtimeKind: 'all', page: 1 })
          }
        ]
      : []),
    ...(gridQuery.androidVersion
      ? [
          {
            id: 'androidVersion',
            label: 'Android',
            value: gridQuery.androidVersion,
            onRemove: () => pushGridParams({ androidVersion: undefined, page: 1 })
          }
        ]
      : []),
    ...(gridQuery.architecture
      ? [
          {
            id: 'architecture',
            label: 'Architecture',
            value: gridQuery.architecture,
            onRemove: () => pushGridParams({ architecture: undefined, page: 1 })
          }
        ]
      : []),
    ...(gridQuery.gmsMode && gridQuery.gmsMode !== 'all'
      ? [
          {
            id: 'gmsMode',
            label: 'Google services',
            value: gridQuery.gmsMode,
            onRemove: () => pushGridParams({ gmsMode: 'all', page: 1 })
          }
        ]
      : [])
  ]

  return (
    <>
      <Section
        surface='plain'
        contentClassName='gap-4'
      >
        <DataGridWorkspace
          search={search}
          searchPlaceholder='Search images'
          onSearchChange={setSearch}
          onSearch={value => pushGridParams({ q: value.trim() || undefined, page: 1 })}
          filters={
            <RuntimeImageFilters
              page={imagesPage}
              query={gridQuery}
              onUpdate={pushGridParams}
            />
          }
          filterTitle='Filter images'
          filterDescription='Find images by ownership, usage, and Android runtime compatibility.'
          activeFilters={activeFilters}
          onResetFilters={() =>
            pushGridParams({
              ownership: 'managed',
              usage: 'all',
              runtimeKind: 'all',
              androidVersion: undefined,
              architecture: undefined,
              gmsMode: 'all',
              page: 1
            })
          }
          selectedCount={selectedImages.length}
          bulkActions={
            <Button
              type='button'
              variant='danger'
              disabled={busyId === 'bulk' || !canRemoveSelectedImages(selectedImages)}
              onClick={() => setPendingRemove(selectedImages)}
            >
              Remove selected
            </Button>
          }
        >
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
                        onSelect={() => setPendingRemove(selectedImages)}
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
                      onSelect={() => setPendingRemove([row.original])}
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
        </DataGridWorkspace>
      </Section>

      <ConfirmMutationDialog
        open={Boolean(pendingRemove)}
        title={pendingRemove?.length === 1 ? 'Remove image?' : `Remove ${pendingRemove?.length ?? 0} images?`}
        description='This permanently removes the selected image data from the container engine.'
        summary={pendingRemove?.length === 1 ? getImageRemoveDialogLabel(pendingRemove[0]) : undefined}
        consequence='Images used by containers may require additional Docker cleanup.'
        confirmLabel={pendingRemove?.length === 1 ? 'Remove image' : 'Remove images'}
        pendingLabel='Removing…'
        pending={busyId !== null}
        onOpenChange={open => {
          if (!open) setPendingRemove(null)
        }}
        onConfirm={() => void removeImages()}
      />
    </>
  )
}
