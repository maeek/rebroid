import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { ImagePullProgress } from '@/features/applications/viewer/components/image-pull-progress'
import { isAppInProgress } from '@/shared/model/applications/app-gallery-status'
import { getAppStatusLabel } from '@/shared/model/applications/app-status-label'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

export const AppViewerStatusSection = ({
  app,
  canDiagnose = false,
  showErrorDetails = false
}: {
  app: AppDefinition
  canDiagnose?: boolean
  showErrorDetails?: boolean
}) => {
  const isError = app.status === 'error'
  const statusLabel = getAppStatusLabel(app.status, app.lifecycleStage)
  const title = app.statusDetail?.title ?? (isError ? 'App needs attention' : statusLabel)
  const description = app.statusDetail?.description ?? app.statusMessage
  const hasExplanation = Boolean(
    app.imagePullProgress ||
    [title, description].some(value => value && value.toLowerCase() !== statusLabel.toLowerCase())
  )
  const showStatus = isError || (isAppInProgress(app.status, app.lifecycleStage) && hasExplanation)
  const hint = showErrorDetails ? app.applicationError?.hint : null
  if (!showStatus && !app.recreateContainerOnNextStart) return null
  return (
    <div className='grid gap-3'>
      {showStatus ? (
        <Notice
          tone={isError ? 'danger' : 'info'}
          title={title.charAt(0).toUpperCase() + title.slice(1)}
          actions={
            isError && canDiagnose ? (
              <Button
                asChild
                variant='outline'
                size='sm'
              >
                <Link href={`/apps/${encodeURIComponent(app.id)}?view=diagnostics`}>Inspect failure</Link>
              </Button>
            ) : undefined
          }
        >
          {app.imagePullProgress || (description && description !== title) ? (
            <ImagePullProgress
              statusMessage={description ?? title}
              progress={app.imagePullProgress}
            />
          ) : null}
          {hint ? <p className='text-sm'>{hint}</p> : null}
          {showErrorDetails && app.applicationError ? (
            <p className='text-xs text-foreground-muted'>
              Reference: {app.applicationError.code} · {app.applicationError.phase}
            </p>
          ) : null}
        </Notice>
      ) : null}
      {app.recreateContainerOnNextStart ? (
        <Notice
          tone='warning'
          title='Runtime update pending'
          description='The container will be recreated with these changes on its next start.'
        />
      ) : null}
    </div>
  )
}
