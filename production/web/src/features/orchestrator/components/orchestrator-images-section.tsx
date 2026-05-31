'use client'

import { useEffect, useMemo, useState } from 'react'
import { IconEye, IconLoader2, IconRefresh, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Visible } from '@/components/ui/visible'
import { imageDisplayName } from '@/features/orchestrator/domain/image-display-name'
import { toast } from '@/hooks/use-toast'
import { formatUtcDate } from '@/lib/format'
import { listPlatformImagesAction, removePlatformImageAction } from '@/server/orchestrator/platform/actions'
import { PlatformGridPagination } from './platform-grid-pagination'
import { PlatformResourceScopeFilter, type PlatformResourceScope } from './platform-resource-scope-filter'
import { PlatformSelectionToolbar } from './platform-selection-toolbar'
import { useGridSelection } from './use-grid-selection'
import type { PlatformImage } from '@/server/orchestrator/platform/types'

const formatBytes = (bytes: number) => {
  if (!bytes) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(2)} ${units[index]}`
}

const isManagedImage = (image: PlatformImage) => image.managed

const ImageNameCell = ({ image }: { image: PlatformImage }) => {
  const name = imageDisplayName(image)
  const secondary = image.repoTags.length > 1 ? image.repoTags.slice(1).join(', ') : image.repoDigests[0]

  return (
    <div className='flex min-w-[18rem] flex-col gap-1'>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={`/settings/orchestrator/images/${encodeURIComponent(image.id)}`}
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

export const OrchestratorImagesSection = ({ refreshKey = 0 }: { refreshKey?: number }) => {
  const [images, setImages] = useState<PlatformImage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [resourceScope, setResourceScope] = useState<PlatformResourceScope>('managed')
  const [pendingRemove, setPendingRemove] = useState<PlatformImage | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const sortedImages = useMemo(
    () =>
      [...images].sort((a, b) => {
        const newestFirst = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        return newestFirst || imageDisplayName(a).localeCompare(imageDisplayName(b))
      }),
    [images]
  )

  const filteredImages = useMemo(() => {
    const query = search.trim().toLowerCase()
    const scopedImages = resourceScope === 'managed' ? sortedImages.filter(isManagedImage) : sortedImages
    if (!query) return scopedImages

    return scopedImages.filter(image =>
      [
        image.id,
        image.shortId,
        ...image.repoTags,
        ...image.repoDigests,
        String(image.sizeBytes),
        String(image.containers)
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [resourceScope, search, sortedImages])

  const selection = useGridSelection(filteredImages)

  const paginatedImages = useMemo(
    () => filteredImages.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [filteredImages, pageIndex, pageSize]
  )

  const refresh = async () => {
    setIsLoading(true)
    try {
      setImages(await listPlatformImagesAction())
      setError(null)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not load image inventory.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [refreshKey])

  useEffect(() => {
    setPageIndex(0)
  }, [resourceScope, search])

  useEffect(() => {
    const pageCount = Math.max(Math.ceil(filteredImages.length / pageSize), 1)
    if (pageIndex >= pageCount) {
      setPageIndex(pageCount - 1)
    }
  }, [filteredImages.length, pageIndex, pageSize])

  const removeImage = async () => {
    if (!pendingRemove) {
      return
    }

    setBusyId(pendingRemove.id)
    try {
      await removePlatformImageAction(pendingRemove.id)
      toast({ title: 'Image removed' })
      setPendingRemove(null)
      await refresh()
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
    const targets = selection.selectedItems
    if (targets.length === 0) {
      return
    }

    setBusyId('bulk')
    try {
      await Promise.all(targets.map(image => removePlatformImageAction(image.id)))
      selection.clearSelection()
      toast({ title: 'Selected images removed' })
      await refresh()
    } catch (caughtError) {
      toast({
        title: 'Could not remove selected images',
        description: caughtError instanceof Error ? caughtError.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusyId(null)
    }
  }

  const emptyMessage = search.trim() ? 'No images match this search.' : 'No images are visible to Docker.'

  return (
    <>
      <Section
        title='Images'
        boxed
        titleClassName='pb-4'
        contentClassName='gap-4'
      >
        <div className='flex items-center justify-between gap-3'>
          <p className='text-sm text-secondary-foreground'>
            Docker images available to start application containers or custom runtimes.
          </p>
        </div>
        <PlatformSelectionToolbar
          search={search}
          placeholder='Search images'
          selectedCount={selection.selectedItems.length}
          filters={
            <PlatformResourceScopeFilter
              value={resourceScope}
              onValueChange={setResourceScope}
            />
          }
          onSearchChange={setSearch}
          actions={
            <>
              <Button
                type='button'
                variant='ghost'
                disabled={isLoading}
                onClick={() => void refresh()}
              >
                {isLoading ? <IconLoader2 className='size-4 animate-spin' /> : <IconRefresh className='size-4' />}
                Refresh
              </Button>
              <Button
                type='button'
                variant='ghost'
                disabled={busyId === 'bulk' || selection.selectedItems.length === 0}
                onClick={() => void removeSelectedImages()}
              >
                Remove selected
              </Button>
            </>
          }
        />
        <Visible when={error}>
          <div className='rounded-md border border-destructive/35 bg-destructive/10 p-4 text-sm text-destructive'>
            {error}
          </div>
        </Visible>
        <Visible when={!error}>
          <div className='overflow-hidden rounded-lg border border-border/60 bg-background/25'>
            <div className='overflow-x-auto'>
              <TooltipProvider delayDuration={150}>
                <Table
                  className='table-fixed'
                  style={{ minWidth: '72rem' }}
                >
                  <TableHeader className='bg-background/45'>
                    <TableRow className='hover:bg-transparent'>
                      <TableHead className='w-12 px-4 py-3'>
                        <Checkbox
                          checked={
                            paginatedImages.length > 0 &&
                            paginatedImages.every(image => selection.selectedIds.has(image.id))
                          }
                          onCheckedChange={checked => selection.selectPage(paginatedImages, checked === true)}
                        />
                      </TableHead>
                      <TableHead className='w-[24rem] px-4 py-3 uppercase'>Image</TableHead>
                      <TableHead className='w-36 px-4 py-3 uppercase'>Size</TableHead>
                      <TableHead className='w-36 px-4 py-3 uppercase'>Created</TableHead>
                      <TableHead className='w-32 px-4 py-3 uppercase'>Containers</TableHead>
                      <TableHead className='w-[14rem] px-4 py-3 uppercase'>ID</TableHead>
                      <TableHead className='w-40 px-4 py-3 text-right uppercase'>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <Visible when={isLoading && images.length === 0}>
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className='px-4 py-4 text-sm text-secondary-foreground'
                        >
                          Loading images...
                        </TableCell>
                      </TableRow>
                    </Visible>
                    <Visible when={!isLoading && filteredImages.length === 0}>
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className='px-4 py-4 text-sm text-secondary-foreground'
                        >
                          {emptyMessage}
                        </TableCell>
                      </TableRow>
                    </Visible>
                    <Visible when={filteredImages.length > 0}>
                      {paginatedImages.map((image, index) => (
                        <TableRow key={image.id}>
                          <TableCell className='px-4 py-3'>
                            <Checkbox
                              checked={selection.selectedIds.has(image.id)}
                              onClick={event =>
                                selection.toggleSelection(image, pageIndex * pageSize + index, event.shiftKey)
                              }
                              onCheckedChange={() => undefined}
                            />
                          </TableCell>
                          <TableCell className='px-4 py-3 align-top'>
                            <ImageNameCell image={image} />
                          </TableCell>
                          <TableCell className='px-4 py-3 align-top text-sm text-secondary-foreground'>
                            {formatBytes(image.sizeBytes)}
                          </TableCell>
                          <TableCell className='px-4 py-3 align-top text-sm text-secondary-foreground'>
                            {formatUtcDate(image.createdAt)}
                          </TableCell>
                          <TableCell className='px-4 py-3 align-top text-sm text-secondary-foreground'>
                            {image.containers < 0 ? 'unknown' : image.containers}
                          </TableCell>
                          <TableCell className='px-4 py-3 align-top text-sm text-secondary-foreground'>
                            {image.shortId}
                          </TableCell>
                          <TableCell className='px-4 py-3 align-top'>
                            <div className='flex justify-end gap-2'>
                              <Button
                                asChild
                                variant='secondary'
                              >
                                <Link href={`/settings/orchestrator/images/${encodeURIComponent(image.id)}`}>
                                  <IconEye className='size-4' />
                                </Link>
                              </Button>
                              <Button
                                type='button'
                                variant='destructive'
                                disabled={busyId === image.id || busyId === 'bulk'}
                                onClick={() => setPendingRemove(image)}
                              >
                                <IconTrash className='size-4' />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </Visible>
                  </TableBody>
                </Table>
              </TooltipProvider>
            </div>
          </div>
        </Visible>
        <Visible when={!error}>
          <PlatformGridPagination
            totalItems={filteredImages.length}
            pageIndex={pageIndex}
            pageSize={pageSize}
            onPageIndexChange={setPageIndex}
            onPageSizeChange={setPageSize}
          />
        </Visible>
      </Section>

      <Dialog
        modal
        open={Boolean(pendingRemove)}
        onOpenChange={open => {
          if (!open) {
            setPendingRemove(null)
          }
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
