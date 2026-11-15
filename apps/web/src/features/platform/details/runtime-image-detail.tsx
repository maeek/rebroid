'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { IconDownload, IconTrash } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
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
import { MutationButton } from '@/components/ui/mutation-button'
import { Skeleton } from '@/components/ui/skeleton'
import { Visible } from '@/components/ui/visible'
import { RuntimeImageBadges } from '@/features/platform/components/runtime-image-badges'
import { RuntimeImagePullNotice, unconfirmedImagePull } from '@/features/platform/components/runtime-image-pull-notice'
import { RelatedContainersGrid } from '@/features/platform/details/related-containers-grid'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { pullPlatformImageAction, removePlatformImageAction } from '@/server/orchestrator/platform/image-actions'
import { unwrapActionResult, type ActionError } from '@/shared/actions/action-result'
import { imageDisplayName } from '@/shared/model/runtime-image/image-display-name'
import { DetailFields } from '@/shared/ui/detail-fields'
import { JsonViewer } from '@/shared/ui/json-viewer'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent } from '@/shared/ui/page/page-layout'
import { formatPlatformBytes, formatPlatformDate } from '@/shared/ui/platform/platform-detail-parts'
import { PlatformLabelsSection } from '@/shared/ui/platform/platform-labels-section'
import { PlatformResourceSection } from '@/shared/ui/platform/platform-resource-section'
import type { PlatformImageDetails } from '@/shared/contracts/platform'

const RuntimeImageActions = ({
  onPull,
  onRemove,
  isPulling = false,
  isRemoving = false
}: {
  onPull?: () => void
  onRemove?: () => void
  isPulling?: boolean
  isRemoving?: boolean
}) => (
  <>
    <MutationButton
      type='button'
      variant='secondary'
      disabled={!onPull || isRemoving}
      pending={isPulling}
      pendingLabel='Pulling image…'
      animate
      onClick={onPull}
    >
      <IconDownload className='size-4' />
      Pull again
    </MutationButton>
    <Button
      type='button'
      variant='danger'
      disabled={!onRemove || isRemoving || isPulling}
      onClick={onRemove}
    >
      <IconTrash className='size-4' />
      Remove
    </Button>
  </>
)

export const RuntimeImageDetail = ({ details }: { details: PlatformImageDetails }) => {
  const router = useRouter()
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [isPulling, startPull] = useTransition()
  const [pullFailure, setPullFailure] = useState<ActionError | null>(null)
  const image = details.image
  const pullReference = image.repoTags[0] ?? image.repoDigests[0]

  const pullImage = () => {
    if (!pullReference || isPulling || isRemoving) return

    const sourcePath = window.location.pathname
    setPullFailure(null)
    startPull(async () => {
      try {
        const result = await pullPlatformImageAction('from-reference', pullReference)
        if (!result.ok) {
          setPullFailure(result.error)
          return
        }

        toast({ title: 'Image pulled', description: pullReference, variant: 'success' })
        if (window.location.pathname === sourcePath) {
          router.replace(`/runtime/images/${encodeURIComponent(pullReference)}`)
        }
      } catch {
        setPullFailure(unconfirmedImagePull)
      }
    })
  }

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
      <RuntimeImagePageContent
        details={details}
        description={pullReference ? undefined : 'This image has no registry tag or digest.'}
        actions={
          <RuntimeImageActions
            onPull={pullReference ? pullImage : undefined}
            onRemove={() => setRemoveDialogOpen(true)}
            isPulling={isPulling}
            isRemoving={isRemoving}
          />
        }
        feedback={
          <>
            <span
              role='status'
              className='sr-only'
            >
              {isPulling ? 'Pulling image…' : null}
            </span>
            {pullFailure ? <RuntimeImagePullNotice failure={pullFailure} /> : null}
          </>
        }
      />

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

export const RuntimeImagePageContent = ({
  details,
  description,
  actions,
  feedback,
  loading = false
}: {
  details?: PlatformImageDetails
  description?: string
  actions?: ReactNode
  feedback?: ReactNode
  loading?: boolean
}) => {
  const image = details?.image
  return (
    <>
      <PageHeader
        section={{ label: 'Docker' }}
        breadcrumbLabel={image ? undefined : 'Image'}
        trail={[{ label: 'Images', href: '/runtime/images' }]}
        title={image ? imageDisplayName(image) : <Skeleton className='h-9 w-64 max-w-full max-sm:h-7' />}
        badges={image ? <RuntimeImageBadges image={image} /> : <Skeleton className='h-5 w-24' />}
        meta={<span className='font-mono'>{image?.shortId}</span>}
        description={description}
        actions={actions ?? <RuntimeImageActions />}
      />
      <PageContent>
        {feedback}
        <PlatformResourceSection
          title='Overview'
          surface='plain'
          contentClassName='gap-5'
        >
          <DetailFields
            loading={loading}
            title='Image'
            fields={[
              { label: 'Image ID', value: image?.id, copyValue: image?.id, code: true, fullWidth: true },
              {
                label: 'Tags',
                value: (image?.repoTags.length ?? 0) > 0 ? image?.repoTags.join(', ') : 'none',
                code: true,
                fullWidth: true
              },
              { label: 'Size', value: formatPlatformBytes(image?.sizeBytes ?? 0) },
              {
                label: 'Digests',
                value: (image?.repoDigests.length ?? 0) > 0 ? image?.repoDigests.join(', ') : 'none',
                code: true,
                fullWidth: true
              },
              { label: 'Virtual size', value: formatPlatformBytes(image?.virtualSizeBytes ?? 0) },
              { label: 'Created', value: formatPlatformDate(image?.createdAt) },
              { label: 'Containers', value: (image?.containers ?? -1) < 0 ? 'unknown' : image?.containers }
            ]}
          />
        </PlatformResourceSection>

        <PlatformResourceSection
          surface='plain'
          title='Related containers'
          contentClassName='gap-4'
          headingSpacing='compact'
        >
          <Visible when={loading || (details?.relatedContainers.length ?? 0) > 0}>
            <RelatedContainersGrid
              containers={details?.relatedContainers ?? []}
              loading={loading}
              relation='application'
            />
          </Visible>
          <Visible when={!loading && details?.relatedContainers.length === 0}>
            <p className='text-sm text-foreground-muted'>No local containers reference this image.</p>
          </Visible>
        </PlatformResourceSection>

        <PlatformLabelsSection
          labels={image?.labels ?? {}}
          loading={loading}
        />
        <JsonViewer
          title='Raw inspect'
          value={details?.inspect}
          loading={loading}
        />
      </PageContent>
    </>
  )
}
