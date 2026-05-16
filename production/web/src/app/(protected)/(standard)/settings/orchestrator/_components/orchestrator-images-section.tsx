'use client'

import { useEffect, useMemo, useState } from 'react'
import { IconRefresh, IconSearch, IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from '@/hooks/use-toast'
import { listPlatformImagesAction, removePlatformImageAction } from '@/lib/orchestrator/actions'
import type { PlatformImage } from '@/lib/orchestrator/types'

const formatBytes = (bytes: number) => {
  if (!bytes) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(2)} ${units[index]}`
}

const imageDisplayName = (image: PlatformImage) => image.repoTags[0] ?? image.repoDigests[0] ?? image.shortId

const ImageNameCell = ({ image }: { image: PlatformImage }) => {
  const name = imageDisplayName(image)
  const secondary = image.repoTags.length > 1 ? image.repoTags.slice(1).join(', ') : image.repoDigests[0]

  return (
    <div className='flex min-w-[18rem] flex-col gap-1'>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className='block truncate font-medium'>{name}</span>
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
  const [pendingRemove, setPendingRemove] = useState<PlatformImage | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

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
    if (!query) {
      return sortedImages
    }

    return sortedImages.filter(image =>
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
  }, [search, sortedImages])

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
          <Button
            type='button'
            variant='secondary'
            disabled={isLoading}
            onClick={() => void refresh()}
          >
            <IconRefresh className={isLoading ? 'size-4 animate-spin' : 'size-4'} />
            Refresh
          </Button>
        </div>
        <div className='relative max-w-md'>
          <IconSearch className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={search}
            placeholder='Search images'
            className='pl-9'
            onChange={event => setSearch(event.target.value)}
          />
        </div>
        {error ? (
          <div className='rounded-md border border-destructive/35 bg-destructive/10 p-4 text-sm text-destructive'>
            {error}
          </div>
        ) : (
          <div className='overflow-hidden rounded-lg border border-border/60 bg-background/25'>
            <div className='overflow-x-auto'>
              <TooltipProvider delayDuration={150}>
                <Table
                  className='table-fixed'
                  style={{ minWidth: '72rem' }}
                >
                  <TableHeader className='bg-background/45'>
                    <TableRow className='hover:bg-transparent'>
                      <TableHead className='w-[24rem] px-4 py-3 uppercase'>Image</TableHead>
                      <TableHead className='w-36 px-4 py-3 uppercase'>Size</TableHead>
                      <TableHead className='w-36 px-4 py-3 uppercase'>Created</TableHead>
                      <TableHead className='w-32 px-4 py-3 uppercase'>Containers</TableHead>
                      <TableHead className='w-[14rem] px-4 py-3 uppercase'>ID</TableHead>
                      <TableHead className='w-40 px-4 py-3 text-right uppercase'>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && images.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className='px-4 py-4 text-sm text-secondary-foreground'
                        >
                          Loading images...
                        </TableCell>
                      </TableRow>
                    ) : filteredImages.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className='px-4 py-4 text-sm text-secondary-foreground'
                        >
                          {emptyMessage}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredImages.map(image => (
                        <TableRow key={image.id}>
                          <TableCell className='px-4 py-3 align-top'>
                            <ImageNameCell image={image} />
                          </TableCell>
                          <TableCell className='px-4 py-3 align-top text-sm text-secondary-foreground'>
                            {formatBytes(image.sizeBytes)}
                          </TableCell>
                          <TableCell className='px-4 py-3 align-top text-sm text-secondary-foreground'>
                            {new Date(image.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className='px-4 py-3 align-top text-sm text-secondary-foreground'>
                            {image.containers < 0 ? 'unknown' : image.containers}
                          </TableCell>
                          <TableCell className='px-4 py-3 align-top text-sm text-secondary-foreground'>
                            {image.shortId}
                          </TableCell>
                          <TableCell className='px-4 py-3 align-top'>
                            <div className='flex justify-end'>
                              <Button
                                type='button'
                                variant='destructive'
                                disabled={busyId === image.id}
                                onClick={() => setPendingRemove(image)}
                              >
                                <IconTrash className='size-4' />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TooltipProvider>
            </div>
          </div>
        )}
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
