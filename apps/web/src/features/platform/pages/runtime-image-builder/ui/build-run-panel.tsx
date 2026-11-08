import type { ReactNode } from 'react'
import { IconHammer } from '@tabler/icons-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Skeleton } from '@/components/ui/skeleton'
import { DetailFields } from '@/shared/ui/detail-fields'
import { PlatformResourceSection } from '@/shared/ui/platform/platform-resource-section'
import { ResourceLink } from '@/shared/ui/resource-link'
import type { ContainerImageBuildJob } from '@/shared/contracts/platform'

export const BuildRunPanel = ({
  job,
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
  running: boolean
  cancelling: boolean
  settingDefault?: boolean
  onCancel: () => void
  onSetAsDefault: () => void
  createAppHref: string
  children?: ReactNode
  loading?: boolean
}) => {
  let tone: 'neutral' | 'success' | 'danger' = 'neutral'
  if (job?.status === 'succeeded') tone = 'success'
  if (job?.status === 'failed') tone = 'danger'
  return (
    <PlatformResourceSection
      surface='plain'
      title='Build status'
      contentClassName='gap-5'
      actions={
        running ? (
          <MutationButton
            type='button'
            variant='ghost'
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
          {job ? (
            <>
              <div
                className='flex flex-wrap items-center gap-3'
                role='status'
              >
                <Badge variant={tone}>{job.status}</Badge>
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
            </>
          ) : (
            <div className='flex min-h-28 items-start gap-4 py-2'>
              <IconHammer className='mt-1 size-6 shrink-0 text-foreground-muted' />
              <div className='grid gap-2'>
                <p className='text-sm font-medium'>No build started</p>
                <p className='max-w-md text-sm leading-6 text-foreground-muted'>
                  Review the configuration and build checks, then choose Build image. Status, output, and the finished
                  image will appear here.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </PlatformResourceSection>
  )
}
