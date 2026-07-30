'use client'

import { useState } from 'react'
import { IconTrash } from '@tabler/icons-react'
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
import { Visible } from '@/components/ui/visible'
import { RelatedContainersGrid } from '@/features/platform/details/related-containers-grid'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { removePlatformImageAction } from '@/server/orchestrator/platform/image-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { DefinitionTable } from '@/shared/ui/definition-table'
import { PageContent } from '@/shared/ui/page/page-layout'
import { PlatformJsonBlock, formatPlatformBytes, formatPlatformDate } from '@/shared/ui/platform/platform-detail-parts'
import type { PlatformImageDetails } from '@/shared/contracts/platform'

export const RuntimeImageDetail = ({ details }: { details: PlatformImageDetails }) => {
  const router = useRouter()
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const image = details.image

  const removeImage = async () => {
    setIsRemoving(true)
    try {
      unwrapActionResult(await removePlatformImageAction(image.id))
      toast({ title: 'Image removed' })
      router.push('/runtime/images')
    } catch (error) {
      toast({
        title: 'Could not remove image',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <>
      <PageContent>
        <Section
          title='Overview'
          surface='plain'
          contentClassName='gap-5'
        >
          <div className='flex flex-wrap items-center justify-between gap-4'>
            <div className='flex min-w-0 flex-col gap-2'>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge variant='neutral'>image</Badge>
                <span className='font-mono text-xs text-foreground-muted'>{image.shortId}</span>
              </div>
            </div>
            <Button
              type='button'
              variant='danger'
              disabled={isRemoving}
              onClick={() => setRemoveDialogOpen(true)}
            >
              <IconTrash className='size-4' />
              Remove
            </Button>
          </div>
          <DefinitionTable
            columns={2}
            items={[
              { label: 'Tags', value: image.repoTags.length > 0 ? image.repoTags.join(', ') : 'none' },
              { label: 'Size', value: formatPlatformBytes(image.sizeBytes) },
              { label: 'Digests', value: image.repoDigests.length > 0 ? image.repoDigests.join(', ') : 'none' },
              { label: 'Virtual size', value: formatPlatformBytes(image.virtualSizeBytes) },
              { label: 'Created', value: formatPlatformDate(image.createdAt) },
              { label: 'Containers', value: image.containers < 0 ? 'unknown' : image.containers }
            ]}
          />
        </Section>

        <Section
          surface='plain'
          title='Related containers'
          contentClassName='gap-4'
          headingSpacing='compact'
        >
          <Visible when={details.relatedContainers.length > 0}>
            <RelatedContainersGrid
              containers={details.relatedContainers}
              relation='application'
            />
          </Visible>
          <Visible when={details.relatedContainers.length === 0}>
            <p className='text-sm text-foreground-muted'>No local containers reference this image.</p>
          </Visible>
        </Section>

        <Section
          title='Labels'
          surface='plain'
          contentClassName='gap-4'
          headingSpacing='default'
        >
          <PlatformJsonBlock value={image.labels} />
        </Section>

        <Section
          title='Raw inspect'
          surface='plain'
          collapsible
          contentClassName='gap-4'
        >
          <PlatformJsonBlock value={details.inspect} />
        </Section>
      </PageContent>

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
              variant='danger'
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
