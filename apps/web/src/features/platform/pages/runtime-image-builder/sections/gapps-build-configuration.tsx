import { IconExternalLink, IconTrash } from '@tabler/icons-react'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { DetailFields } from '@/shared/ui/detail-fields'
import { PlatformResourceSection } from '@/shared/ui/platform/platform-resource-section'
import { bytesToGb } from '../model/gapps-build'
import type { GappsBuildController } from '../hooks/use-gapps-build-controller'
import type { GappsBuildPresetsResponse } from '@/shared/contracts/platform'

type GappsConfigurationState = Pick<
  GappsBuildController,
  | 'preset'
  | 'androidVersion'
  | 'selectVersion'
  | 'targetImage'
  | 'setTargetImage'
  | 'isRunning'
  | 'isStarting'
  | 'isClearing'
  | 'clearCache'
>

export const GappsBuildConfiguration = ({
  controller,
  resources,
  loading = false
}: {
  controller: GappsConfigurationState
  resources: GappsBuildPresetsResponse['resources']
  loading?: boolean
}) => {
  const disabled = loading || controller.isRunning || controller.isStarting || controller.isClearing
  return (
    <PlatformResourceSection
      surface='plain'
      title='Image configuration'
      description='Choose the Android base and name the image to create.'
      contentClassName='gap-6'
    >
      <FormField
        controlId='gapps-android-version'
        label='Android version'
        layout='vertical'
      >
        <Select
          value={controller.androidVersion}
          disabled={disabled}
          onValueChange={controller.selectVersion}
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='14'>Android 14</SelectItem>
            <SelectItem value='13'>Android 13</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <FormField
        controlId='gapps-target-image'
        label='Target image'
        description='Local image name and tag used after the build completes.'
        layout='vertical'
      >
        {loading ? (
          <Skeleton className='h-9 w-full' />
        ) : (
          <Input
            value={controller.targetImage}
            disabled={disabled}
            onChange={event => controller.setTargetImage(event.target.value)}
          />
        )}
      </FormField>
      <DetailFields
        loading={loading}
        fields={[
          { label: 'Base image', value: controller.preset?.baseImage, code: true },
          {
            label: 'Google apps source',
            value: controller.preset ? (
              <a
                className='inline-flex items-center gap-1 text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                href={controller.preset.sourceLink}
                target='_blank'
                rel='noreferrer'
              >
                MindTheGapps · {controller.preset.sourceBranch}
                <IconExternalLink className='size-3.5' />
              </a>
            ) : (
              'No preset available'
            )
          }
        ]}
      />
      {loading ? (
        <Skeleton className='h-[4.5rem] w-full' />
      ) : (
        <Notice
          tone={resources.canBuild ? 'success' : 'warning'}
          title={resources.canBuild ? 'Host ready to build' : 'Build requirements not met'}
        >
          <ul className='grid gap-1 text-sm text-foreground-muted'>
            {resources.messages.map(message => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Notice>
      )}
      <DetailFields
        loading={loading}
        fields={[
          { label: 'Available disk', value: bytesToGb(resources.diskAvailableBytes) },
          { label: 'Available memory', value: bytesToGb(resources.memoryAvailableBytes) },
          { label: 'CPUs', value: resources.cpuCount }
        ]}
      />
      <Section
        surface='plain'
        title='Package cache'
        description='Reuse verified packages to speed up later builds.'
        collapsible
      >
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <p className='max-w-sm text-sm text-foreground-muted'>
            Clear the verified Android {controller.androidVersion} packages. They will be rebuilt when needed.
          </p>
          <MutationButton
            type='button'
            variant='secondary'
            pending={controller.isClearing}
            pendingLabel='Clearing…'
            disabled={disabled}
            onClick={() => void controller.clearCache()}
          >
            <IconTrash className='size-4' /> Clear cache
          </MutationButton>
        </div>
      </Section>
    </PlatformResourceSection>
  )
}
