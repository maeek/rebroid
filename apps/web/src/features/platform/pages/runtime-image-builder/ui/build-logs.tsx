import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { LogsConsole } from '@/shared/ui/logs/logs-console'
import { PlatformResourceSection } from '@/shared/ui/platform/platform-resource-section'
import type { ContainerImageBuildJob } from '@/shared/contracts/platform'

export const BuildLogs = ({ job, running }: { job: ContainerImageBuildJob; running: boolean }) => {
  const [follow, setFollow] = useState(true)
  return (
    <PlatformResourceSection
      surface='plain'
      title='Build logs'
      description='Latest output from this build.'
    >
      <LogsConsole
        log={{ output: job.logTail, collectedAt: job.updatedAt }}
        outputLabel='Build logs'
        showCollectedAt={false}
        emptyMessage='Waiting for build output…'
        followOutput={running && follow}
        outputClassName='h-72 min-h-72 max-w-full min-w-0 whitespace-pre'
        controls={
          running ? (
            <label
              htmlFor='follow-build-logs'
              className='inline-flex items-center gap-3 text-sm text-foreground-muted'
            >
              <Switch
                id='follow-build-logs'
                checked={follow}
                onCheckedChange={setFollow}
              />
              Follow latest output
            </label>
          ) : undefined
        }
      />
    </PlatformResourceSection>
  )
}
