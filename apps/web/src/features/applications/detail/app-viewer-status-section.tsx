import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { ImagePullProgress } from '@/features/applications/viewer/components/image-pull-progress'
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
  const title = app.statusDetail?.title ?? (isError ? 'App needs attention' : app.lifecycleStage.replaceAll('_', ' '))
  const description = app.statusDetail?.description ?? app.statusMessage
  let tone: 'danger' | 'success' | 'info' = 'info'
  if (isError) tone = 'danger'
  else if (app.running) tone = 'success'
  const hint = showErrorDetails ? app.applicationError?.hint : null
  return (
    <div className='grid gap-3'>
      <Notice
        tone={tone}
        title={title.charAt(0).toUpperCase() + title.slice(1)}
        actions={
          isError && canDiagnose ? (
            <Button
              asChild
              variant='outline'
              size='sm'
            >
              <Link href={`/app/${encodeURIComponent(app.id)}?view=diagnostics`}>Inspect failure</Link>
            </Button>
          ) : undefined
        }
      >
        {description ? (
          <ImagePullProgress
            statusMessage={description}
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
      {app.recreateContainerOnNextStart ? (
        <Notice
          tone='warning'
          title='Configuration saved; runtime update pending'
          description='The container will be recreated with these changes on its next start.'
        />
      ) : null}
    </div>
  )
}
