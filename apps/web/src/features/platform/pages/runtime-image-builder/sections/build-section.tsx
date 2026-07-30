import { IconHammer, IconPlayerStop, IconPlus } from '@tabler/icons-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MutationButton } from '@/components/ui/mutation-button'
import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import type { ContainerImageBuildJob } from '@/shared/contracts/platform'

type BuildSectionProps = {
  activeJob: ContainerImageBuildJob | null
  canStart: boolean
  isActiveJobRunning: boolean
  isCancelling: boolean
  isStarting: boolean
  onCancelBuild: () => void
  onSetAsDefault: () => void
  onStartBuild: () => void
}

const buildStatusVariant = (status: ContainerImageBuildJob['status']) => {
  if (status === 'succeeded') return 'success'
  if (status === 'failed') return 'danger'
  return 'neutral'
}

export const BuildSection = ({
  activeJob,
  canStart,
  isActiveJobRunning,
  isCancelling,
  isStarting,
  onCancelBuild,
  onSetAsDefault,
  onStartBuild
}: BuildSectionProps) => (
  <Section
    surface='plain'
    title='Build'
    contentClassName='gap-4'
  >
    <div className='flex flex-wrap items-center gap-2'>
      <MutationButton
        type='button'
        pending={isStarting || isActiveJobRunning}
        pendingLabel={isActiveJobRunning ? 'Build in progress' : 'Starting build…'}
        disabled={!canStart}
        onClick={onStartBuild}
      >
        <IconHammer />
        Build image
      </MutationButton>
      <MutationButton
        type='button'
        variant='secondary'
        pending={isCancelling}
        pendingLabel='Cancelling…'
        disabled={!isActiveJobRunning}
        onClick={onCancelBuild}
      >
        <IconPlayerStop className='size-4' />
        Cancel
      </MutationButton>
      <Visible when={activeJob?.status === 'succeeded'}>
        <Button
          type='button'
          variant='primary'
          onClick={onSetAsDefault}
        >
          Use as default
        </Button>
        <Button
          asChild
          variant='secondary'
        >
          <Link href={`/apps/create?${new URLSearchParams({ image: activeJob?.targetImage ?? '' }).toString()}`}>
            <IconPlus className='size-4' />
            Create app
          </Link>
        </Button>
      </Visible>
    </div>
    {activeJob ? (
      <div className='flex flex-wrap items-center gap-2 text-sm text-foreground-muted'>
        <Badge variant={buildStatusVariant(activeJob.status)}>{activeJob.status}</Badge>
        <span className='font-mono'>{activeJob.targetImage}</span>
        {activeJob.imageId ? <span className='font-mono'>{activeJob.imageId.slice(0, 18)}</span> : null}
      </div>
    ) : null}
    <pre className='max-h-[28rem] min-h-48 max-w-full min-w-0 overflow-auto whitespace-pre rounded-control border border-surface-border/60 bg-surface-band/35 p-3 text-xs leading-5 text-foreground-muted'>
      {activeJob?.logTail ?? 'No build has been started.'}
    </pre>
  </Section>
)
