import { ImagePullProgress } from '@/app/(protected)/_components/viewer/image-pull-progress'
import { Badge } from '@/components/ui/badge'
import { Section } from '@/components/ui/section'
import { AppInfoRow } from './app-info-row'
import type { AppDefinition } from '@/app/(protected)/(standard)/constants'

const formatStatusLabel = (value: string) => value.replaceAll('_', ' ')

export const AppInfoOverviewSection = ({ app }: { app?: AppDefinition }) => {
  const lifecycleLabel = app ? formatStatusLabel(app.lifecycleStage) : null
  const shouldShowLifecycleBadge =
    app && lifecycleLabel ? lifecycleLabel.toLowerCase() !== app.status.toLowerCase() : false

  return (
    <Section
      title='Overview'
      boxed
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
          app ? (
            <div className='flex flex-wrap items-center justify-end gap-2'>
              <Badge
                variant={app.status === 'error' ? 'destructive' : 'status'}
                className='capitalize'
              >
                {app.status}
              </Badge>
              {shouldShowLifecycleBadge && lifecycleLabel && (
                <Badge
                  variant='secondary'
                  className='capitalize'
                >
                  {lifecycleLabel}
                </Badge>
              )}
            </div>
          ) : (
            'Loading...'
          )
        }
      />
      <AppInfoRow
        label='Progress'
        value={
          app?.statusMessage ? (
            <ImagePullProgress
              statusMessage={app.statusMessage}
              isImagePulling={app.lifecycleStage === 'image_pulling'}
            />
          ) : (
            'Idle'
          )
        }
        valueClassName='w-full sm:max-w-lg sm:justify-end'
      />
    </Section>
  )
}
