'use client'

import { useState } from 'react'
import { IconEye, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
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
import { Section } from '@/components/ui/section'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Visible } from '@/components/ui/visible'
import { ContainerStateBadge } from '@/features/orchestrator/components/orchestrator-containers-table-parts'
import {
  PlatformDetailRow,
  PlatformJsonBlock,
  formatPlatformBytes,
  formatPlatformDate
} from '@/features/orchestrator/components/platform-detail-parts'
import { toast } from '@/hooks/use-toast'
import { removePlatformImageAction } from '@/server/orchestrator/platform/actions'
import type { PlatformImageDetails } from '@/server/orchestrator/platform/types'

export const OrchestratorImageDetail = ({ details }: { details: PlatformImageDetails }) => {
  const router = useRouter()
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const image = details.image

  const removeImage = async () => {
    setIsRemoving(true)
    try {
      await removePlatformImageAction(image.id)
      toast({ title: 'Image removed' })
      router.push('/settings/orchestrator/images')
    } catch (error) {
      toast({
        title: 'Could not remove image',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <>
      <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
        <Section
          title='Overview'
          boxed
          contentClassName='gap-5'
        >
          <div className='flex flex-wrap items-center justify-between gap-4'>
            <div className='flex min-w-0 flex-col gap-2'>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge variant='secondary'>image</Badge>
                <span className='font-mono text-xs text-muted-foreground'>{image.shortId}</span>
              </div>
            </div>
            <Button
              type='button'
              variant='destructive'
              disabled={isRemoving}
              onClick={() => setRemoveDialogOpen(true)}
            >
              <IconTrash className='size-4' />
              Remove
            </Button>
          </div>
          <div className='grid gap-6 xl:grid-cols-2'>
            <div>
              <PlatformDetailRow
                label='Tags'
                value={image.repoTags.length > 0 ? image.repoTags.join(', ') : 'none'}
              />
              <PlatformDetailRow
                label='Digests'
                value={image.repoDigests.length > 0 ? image.repoDigests.join(', ') : 'none'}
              />
              <PlatformDetailRow
                label='Created'
                value={formatPlatformDate(image.createdAt)}
              />
            </div>
            <div>
              <PlatformDetailRow
                label='Size'
                value={formatPlatformBytes(image.sizeBytes)}
              />
              <PlatformDetailRow
                label='Virtual size'
                value={formatPlatformBytes(image.virtualSizeBytes)}
              />
              <PlatformDetailRow
                label='Containers'
                value={image.containers < 0 ? 'unknown' : image.containers}
              />
            </div>
          </div>
        </Section>

        <Section
          title='Related containers'
          boxed
          contentClassName='gap-4'
          titleClassName='pb-4'
        >
          <Visible when={details.relatedContainers.length > 0}>
            <div className='overflow-hidden rounded-lg border border-border/60 bg-background/25'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Container</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Application</TableHead>
                    <TableHead className='text-right'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {details.relatedContainers.map(container => (
                    <TableRow key={container.id}>
                      <TableCell className='font-medium'>{container.names[0] ?? container.shortId}</TableCell>
                      <TableCell>
                        <ContainerStateBadge state={container.state} />
                      </TableCell>
                      <TableCell className='text-secondary-foreground'>
                        {container.applicationId ?? 'unmanaged'}
                      </TableCell>
                      <TableCell className='text-right'>
                        <Button
                          asChild
                          variant='secondary'
                        >
                          <Link href={`/settings/orchestrator/containers/${container.id}`}>
                            <IconEye className='size-4' />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Visible>
          <Visible when={details.relatedContainers.length === 0}>
            <p className='text-sm text-secondary-foreground'>No local containers reference this image.</p>
          </Visible>
        </Section>

        <Section
          title='Labels'
          boxed
          contentClassName='gap-4'
          titleClassName='pb-4'
        >
          <PlatformJsonBlock value={image.labels} />
        </Section>

        <Section
          title='Raw inspect'
          boxed
          contentClassName='gap-4'
        >
          <PlatformJsonBlock value={details.inspect} />
        </Section>
      </section>

      <Dialog
        modal
        open={removeDialogOpen}
        onOpenChange={setRemoveDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove image?</DialogTitle>
            <DialogDescription>This removes the selected image from the container engine.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='destructive'
              disabled={isRemoving}
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
