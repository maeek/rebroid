'use client'

import { useRef, useState, type ReactNode } from 'react'
import { IconDownload, IconTrash } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { MutationButton } from '@/components/ui/mutation-button'
import { Skeleton } from '@/components/ui/skeleton'
import { Visible } from '@/components/ui/visible'
import { RuntimeImageBadges } from '@/features/platform/components/runtime-image-badges'
import {
  RuntimeImagePullNotice,
  RuntimeImagePullStatus
} from '@/features/platform/components/runtime-image-pull-notice'
import { useRuntimeImagePull } from '@/features/platform/components/use-runtime-image-pull'
import { RelatedContainersGrid } from '@/features/platform/details/related-containers-grid'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { removePlatformImageAction } from '@/server/orchestrator/platform/image-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { imageDisplayName } from '@/shared/model/runtime-image/image-display-name'
import { DetailFields } from '@/shared/ui/detail-fields'
import { JsonViewer } from '@/shared/ui/json-viewer'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent } from '@/shared/ui/page/page-layout'
import { formatPlatformBytes, formatPlatformDate } from '@/shared/ui/platform/platform-detail-parts'
import { PlatformLabelsSection } from '@/shared/ui/platform/platform-labels-section'
import { PlatformResourceSection } from '@/shared/ui/platform/platform-resource-section'
import { StateView } from '@/shared/ui/state-view'
import type { PlatformImageDetails } from '@/shared/contracts/platform'

const RuntimeImageActions = ({
  onPull,
  onRemove,
  isPulling = false,
  isRemoving = false,
  pullStatus
}: {
  onPull?: () => void
  onRemove?: () => void
  isPulling?: boolean
  isRemoving?: boolean
  pullStatus?: string
}) => (
  <>
    <MutationButton
      type='button'
      variant='secondary'
      disabled={!onPull || isRemoving}
      pending={isPulling}
      pendingLabel={pullStatus}
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
  const image = details.image
  const pullReference = image.repoTags[0] ?? image.repoDigests[0]

  const pullSourcePath = useRef<string>(null)
  const pull = useRuntimeImagePull(() => {
    if (pullReference && window.location.pathname === pullSourcePath.current) {
      router.replace(`/runtime/images/${encodeURIComponent(pullReference)}`)
    }
  })
  const pullImage = () => {
    if (!pullReference || pull.pending || isRemoving) return
    pullSourcePath.current = window.location.pathname
    void pull.start('from-reference', pullReference)
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
            isPulling={pull.pending}
            pullStatus={pull.status}
            isRemoving={isRemoving}
          />
        }
        feedback={
          <>
            <RuntimeImagePullStatus
              pending={pull.pending}
              status={pull.status}
              stale={pull.stale}
            />
            {pull.failure ? <RuntimeImagePullNotice failure={pull.failure} /> : null}
          </>
        }
      />

      <ConfirmMutationDialog
        open={removeDialogOpen}
        title={`Remove “${imageDisplayName(image)}”?`}
        description='Permanently remove this image from Docker. Images used by containers may require additional cleanup.'
        confirmLabel='Remove image'
        pending={isRemoving}
        pendingLabel='Removing…'
        onConfirm={() => void removeImage()}
        onOpenChange={setRemoveDialogOpen}
      />
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
            <StateView
              kind='empty'
              artwork='inventory'
              title='No local containers reference this image.'
            />
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
