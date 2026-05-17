import { IconAlertTriangle, IconCircleCheck, IconLoader2 } from '@tabler/icons-react'
import { ImagePullProgress } from '@/app/(protected)/_components/viewer/image-pull-progress'
import { Badge } from '@/components/ui/badge'
import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import type { AppDefinition } from '../../constants'
import type { AndroidApplicationStatusDetail } from '@/server/orchestrator/applications/types'

type AppImagePullProgress = {
  status: string
  current: string
  total: string
  layerId: string | null
  percent: number
} | null

const hasRuntimeRecreateBadge = (app: AppDefinition) => app.recreateContainerOnNextStart === true

const getAppImagePullProgress = (app: AppDefinition): AppImagePullProgress => app.imagePullProgress

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
  const statusDetail = (app as AppDefinition & { statusDetail: AndroidApplicationStatusDetail | null }).statusDetail
  const statusTitle = statusDetail?.title ?? app.lifecycleStage.replaceAll('_', ' ')
  const statusDescription = statusDetail?.description ?? app.statusMessage

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
          <span className='text-foreground'>{statusTitle}</span>
          <Badge
            variant={isError ? 'destructive' : 'status'}
            className='capitalize'
          >
            {app.status}
          </Badge>
          <Visible when={hasRuntimeRecreateBadge(app)}>
            <Badge variant='warning'>Runtime modified</Badge>
          </Visible>
        </div>
        <Visible when={statusDescription && !hasRuntimeRecreateBadge(app)}>
          <ImagePullProgress
            statusMessage={statusDescription}
            progress={getAppImagePullProgress(app)}
          />
        </Visible>
      </div>
    </Section>
  )
}
