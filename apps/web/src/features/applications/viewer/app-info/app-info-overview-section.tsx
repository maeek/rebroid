import { Badge } from '@/components/ui/badge'
import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { ImagePullProgress } from '@/features/applications/viewer/components/image-pull-progress'
import { AppInfoRow } from './app-info-row'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

const formatStatusLabel = (value: string) => value.replaceAll('_', ' ')

export const AppInfoOverviewSection = ({ app }: { app?: AppDefinition }) => {
  const lifecycleLabel = app ? formatStatusLabel(app.lifecycleStage) : null
  const shouldShowLifecycleBadge =
    app && lifecycleLabel ? lifecycleLabel.toLowerCase() !== app.status.toLowerCase() : false
  const progressDescription = app?.statusDetail?.description ?? app?.statusMessage

  return (
    <Section
      surface='plain'
      title='Overview'
      titleClassName='pb-4'
      contentClassName='flex-col'
    >
      <AppInfoRow
        label='ID'
        value={app?.id || 'Loading...'}
        copyValue={app?.id}
      />
      <AppInfoRow
        label='Status'
        value={
          <>
            <Visible when={app}>
              <div className='flex flex-wrap items-center justify-end gap-2'>
                <Badge
                  variant={app?.status === 'error' ? 'danger' : 'success'}
                  className='capitalize'
                >
                  {app?.status}
                </Badge>
                <Visible when={shouldShowLifecycleBadge && lifecycleLabel}>
                  <Badge
                    variant='neutral'
                    className='capitalize'
                  >
                    {lifecycleLabel}
                  </Badge>
                </Visible>
              </div>
            </Visible>
            <Visible when={!app}>Loading...</Visible>
          </>
        }
      />
      <AppInfoRow
        label='Progress'
        value={
          <>
            <Visible when={progressDescription}>
              <ImagePullProgress
                statusMessage={progressDescription}
                progress={app?.imagePullProgress}
              />
            </Visible>
            <Visible when={!progressDescription}>Idle</Visible>
          </>
        }
        valueClassName='w-full sm:max-w-lg sm:justify-end'
      />
    </Section>
  )
}
