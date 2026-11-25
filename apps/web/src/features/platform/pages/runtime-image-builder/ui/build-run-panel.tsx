import type { ReactNode } from 'react'
import { IconCheck } from '@tabler/icons-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Skeleton } from '@/components/ui/skeleton'
import { StateTransition } from '@/components/ui/state-transition'
import { DetailFields } from '@/shared/ui/detail-fields'
import { PlatformResourceSection } from '@/shared/ui/platform/platform-resource-section'
import { ResourceLink } from '@/shared/ui/resource-link'
import { StateView } from '@/shared/ui/state-view'
import type { UploadProgress } from '../model/dockerfile-context-types'
import type { ContainerImageBuildJob } from '@/shared/contracts/platform'

export const BuildRunPanel = ({
  job,
  starting = false,
  contextUpload,
  running,
  cancelling,
  settingDefault = false,
  onCancel,
  onSetAsDefault,
  createAppHref,
  children,
  loading = false
}: {
  job: ContainerImageBuildJob | null
  starting?: boolean
  contextUpload?: UploadProgress | null
  running: boolean
  cancelling: boolean
  settingDefault?: boolean
  onCancel: () => void
  onSetAsDefault: () => void
  createAppHref: string
  children?: ReactNode
  loading?: boolean
}) => {
  if (!loading && !starting && !job) {
    return (
      <StateView
        kind='empty'
        scope='page'
        headingLevel={2}
        artwork='build'
        artworkSize='panel'
        title='No build started'
        description='Review the configuration and build checks, then choose Build image.'
      />
    )
  }

  let tone: 'neutral' | 'success' | 'danger' = 'neutral'
  if (job?.status === 'succeeded') tone = 'success'
  if (job?.status === 'failed') tone = 'danger'
  return (
    <PlatformResourceSection
      surface='plain'
      title='Build status'
      contentClassName='gap-5'
      actions={
        running && !starting ? (
          <MutationButton
            type='button'
            variant='ghost'
            animate
            pending={cancelling}
            pendingLabel='Cancelling…'
            onClick={onCancel}
          >
            Cancel build
          </MutationButton>
        ) : undefined
      }
    >
      {loading ? (
        <Skeleton className='h-20 w-full' />
      ) : (
        <>
          {starting ? (
            <div
              role='status'
              aria-atomic='true'
              className='grid gap-1 text-sm'
            >
              <p className='font-medium'>{contextUpload ? 'Uploading build context…' : 'Submitting build request…'}</p>
              {contextUpload && contextUpload.total > 0 ? (
                <p className='tabular-nums text-foreground-muted'>
                  {contextUpload.completed} of {contextUpload.total} files uploaded
                </p>
              ) : null}
            </div>
          ) : job ? (
            <>
              <div
                className='flex flex-wrap items-center gap-3'
                role='status'
              >
                <Badge variant={tone}>
                  <StateTransition
                    identity={job.id}
                    state={job.status}
                  >
                    {job.status === 'succeeded' ? (
                      <IconCheck
                        aria-hidden
                        className='size-3.5'
                      />
                    ) : null}
                    {job.status}
                  </StateTransition>
                </Badge>
                <span className='min-w-0 break-all font-mono text-sm'>{job.targetImage}</span>
              </div>
              {job.error ? (
                <Notice
                  tone={job.status === 'cancelled' ? 'info' : 'danger'}
                  title={job.status === 'cancelled' ? 'Build cancelled' : 'Build failed'}
                  description={job.error}
                />
              ) : null}
              {children}
              <StateTransition
                as='div'
                identity={job.id}
                state={job.status}
                className='grid gap-5 empty:hidden'
              >
                {job.status === 'succeeded' ? (
                  <>
                    <DetailFields
                      fields={[
                        {
                          label: 'Built image',
                          value: job.imageId ? (
                            <ResourceLink href={`/runtime/images/${encodeURIComponent(job.imageId)}`}>
                              {job.targetImage}
                            </ResourceLink>
                          ) : (
                            job.targetImage
                          ),
                          copyValue: job.targetImage
                        }
                      ]}
                    />
                    <div className='flex flex-wrap gap-2'>
                      <Button asChild>
                        <Link href={createAppHref}>Create app</Link>
                      </Button>
                      <MutationButton
                        type='button'
                        variant='secondary'
                        pending={settingDefault}
                        pendingLabel='Updating default…'
                        onClick={onSetAsDefault}
                      >
                        Use as default
                      </MutationButton>
                    </div>
                  </>
                ) : null}
              </StateTransition>
            </>
          ) : null}
        </>
      )}
    </PlatformResourceSection>
  )
}
