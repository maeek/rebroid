import { IconExternalLink, IconHammer, IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { MutationButton } from '@/components/ui/mutation-button'
import { cn } from '@/lib/utils'
import { bytesToGb } from '../model/gapps-build'
import type { GappsBuildController } from '../hooks/use-gapps-build-controller'
import type { GappsBuildPresetsResponse, SupportedGappsAndroidVersion } from '@/shared/contracts/platform'

interface GappsBuildConfigurationProps {
  controller: GappsBuildController
  resources: GappsBuildPresetsResponse['resources']
}

const androidVersions: SupportedGappsAndroidVersion[] = ['14', '13']

export const GappsBuildConfiguration = ({ controller, resources }: GappsBuildConfigurationProps) => (
  <div className='min-w-0'>
    <div className='border-b border-surface-border/60 pb-7'>
      <h2 className='text-base font-medium'>Build configuration</h2>
      <p className='mt-1 text-sm text-foreground-muted'>Choose a version and the local tag for the result.</p>
    </div>

    <div className='grid gap-7 py-8'>
      <FormField
        label='Android version'
        layout='vertical'
      >
        <div className='grid w-full grid-cols-2 gap-2'>
          {androidVersions.map(version => (
            <Button
              key={version}
              type='button'
              variant={controller.androidVersion === version ? 'primary' : 'outline'}
              disabled={controller.isRunning}
              onClick={() => controller.selectVersion(version)}
            >
              Android {version}
            </Button>
          ))}
        </div>
      </FormField>

      <FormField
        controlId='gapps-target-image'
        label='Target image'
        layout='vertical'
      >
        <Input
          className='w-full'
          value={controller.targetImage}
          disabled={controller.isRunning}
          onChange={event => controller.setTargetImage(event.target.value)}
        />
      </FormField>

      {controller.preset ? (
        <dl className='grid gap-4 border-y border-surface-border/60 py-5 text-sm sm:grid-cols-2'>
          <div className='min-w-0'>
            <dt className='text-foreground-muted'>ReDroid base</dt>
            <dd className='mt-1 truncate font-mono text-xs'>{controller.preset.baseImage}</dd>
          </div>
          <div>
            <dt className='text-foreground-muted'>Google apps source</dt>
            <dd className='mt-1'>
              <a
                className='inline-flex items-center gap-1 text-primary hover:underline'
                href={controller.preset.sourceLink}
                target='_blank'
                rel='noreferrer'
              >
                MindTheGapps · {controller.preset.sourceBranch} <IconExternalLink className='size-3.5' />
              </a>
            </dd>
          </div>
        </dl>
      ) : null}

      <div className={cn('border-l-2 pl-4 text-sm', resources.canBuild ? 'border-success' : 'border-danger')}>
        <div className='font-medium'>{resources.messages[0]}</div>
        <div className='mt-1 text-foreground-muted'>
          {bytesToGb(resources.diskAvailableBytes)} free · {bytesToGb(resources.memoryAvailableBytes)} memory ·{' '}
          {resources.cpuCount} CPUs
        </div>
      </div>

      <MutationButton
        className='w-full'
        size='lg'
        pending={controller.isStarting || controller.isRunning}
        pendingLabel={controller.isRunning ? 'Build in progress' : 'Starting build…'}
        disabled={!resources.canBuild || !controller.targetImage.trim()}
        onClick={() => void controller.startBuild()}
      >
        <IconHammer />
        Build image
      </MutationButton>
    </div>

    <details className='group border-t border-surface-border/60 pt-5 text-sm'>
      <summary className='inline-flex cursor-pointer list-none items-center gap-2 font-medium text-foreground-muted hover:text-foreground'>
        <span className='transition-transform group-open:rotate-90'>›</span>
        Cache options
      </summary>
      <div className='mt-4 flex items-center justify-between gap-4 max-sm:items-start'>
        <span className='text-foreground-muted'>
          Remove the verified Android {controller.androidVersion} package cache.
        </span>
        <MutationButton
          variant='outline'
          pending={controller.isClearing}
          pendingLabel='Clearing…'
          disabled={controller.isClearing || controller.isRunning}
          onClick={() => void controller.clearCache()}
        >
          <IconTrash />
          Clear cache
        </MutationButton>
      </div>
    </details>
  </div>
)
