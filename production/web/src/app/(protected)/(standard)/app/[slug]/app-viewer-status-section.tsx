import { IconAlertTriangle, IconCircleCheck, IconLoader2 } from '@tabler/icons-react'
import { ImagePullProgress } from '@/app/(protected)/_components/viewer/image-pull-progress'
import { Badge } from '@/components/ui/badge'
import { Section } from '@/components/ui/section'
import type { AppDefinition } from '../../constants'

const formatStatusLabel = (value: string) => value.replaceAll('_', ' ')

const getStatusIcon = (app: AppDefinition) => {
  if (app.status === 'error') {
    return <IconAlertTriangle className='mr-4 size-6 text-destructive' />
  }

  if (app.status === 'provisioning' || app.status === 'removing') {
    return <IconLoader2 className='mr-4 size-6 animate-spin text-primary' />
  }

  return <IconCircleCheck className='mr-4 size-6 text-primary' />
}

export const AppViewerStatusSection = ({ app }: { app: AppDefinition }) => {
  const isError = app.status === 'error'

  return (
    <Section
      className={
        isError
          ? 'flex flex-row border border-destructive/25 bg-destructive/10 px-4 py-3 hover:bg-destructive/16'
          : 'flex flex-row border border-primary/20 bg-primary/10 px-4 py-3 hover:bg-primary/20'
      }
      contentClassName='grow shrink'
      orientation='horizontal'
    >
      {getStatusIcon(app)}
      <div className='flex w-full grow flex-col gap-1'>
        <div className='flex items-center gap-2'>
          <span className='text-foreground font-light capitalize'>{formatStatusLabel(app.lifecycleStage)}</span>
          <Badge
            variant={isError ? 'destructive' : 'status'}
            className='capitalize'
          >
            {app.status}
          </Badge>
        </div>
        {app.statusMessage && (
          <ImagePullProgress
            statusMessage={app.statusMessage}
            isImagePulling={app.lifecycleStage === 'image_pulling'}
          />
        )}
      </div>
    </Section>
  )
}
