'use client'

import { useMemo } from 'react'
import { IconEye, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { Section } from '@/components/ui/section'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridPagination } from '@/shared/ui/data-grid/data-grid-pagination'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { useRuntimeImageActions } from '../hooks/use-runtime-image-actions'
import { useRuntimeResourceGridController } from '../hooks/use-runtime-resource-grid-controller'
import { RuntimeImageFilters } from './runtime-grid-filter-controls'
import { platformSortFromSearchParam } from './runtime-grid-query-utils'
import { buildImagesGridHref, canRemoveSelectedImages, getImageRemoveDialogLabel } from './runtime-images-section-model'
import { createImageColumns } from './runtime-images-table-parts'
import type { PlatformImagesGridPage, PlatformImagesGridQuery } from '@/shared/contracts/platform'

const imageId = (image: PlatformImagesGridPage['items'][number]) => image.id

export const RuntimeImagesSection = ({
  imagesPage,
  gridQuery
}: {
  imagesPage: PlatformImagesGridPage
  gridQuery: PlatformImagesGridQuery
}) => {
  const {
    search,
    setSearch,
    selectedIds,
    setSelectedIds,
    selectedItems: selectedImages,
    sorting,
    pushGridParams,
    onSearch,
    onSortingChange,
    onPageIndexChange,
    onPageSizeChange,
    clearSelection,
    refresh
  } = useRuntimeResourceGridController({
    items: imagesPage.items,
    gridQuery,
    pageSize: imagesPage.pageSize,
    getItemId: imageId,
    parseSort: sort => platformSortFromSearchParam(sort, { defaultSort: 'createdAt:desc', missingDirection: 'desc' }),
    buildHref: buildImagesGridHref
  })
  const { pendingRemove, setPendingRemove, busyId, removeImages } = useRuntimeImageActions({
    clearSelection,
    refresh
  })

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
          onSearch={onSearch}
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
              onSortingChange={onSortingChange}
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
            onPageIndexChange={onPageIndexChange}
            onPageSizeChange={onPageSizeChange}
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
