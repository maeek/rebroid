import Link from 'next/link'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

export const AppsAttentionSummary = ({ apps }: { apps: AppDefinition[] }) => {
  const failed = apps.filter(app => app.status === 'error')
  const pending = apps.filter(app => app.status === 'provisioning' || app.status === 'removing')
  if (!failed.length && !pending.length) return null
  return (
    <div className='px-6 max-sm:px-4'>
      <Section
        surface='plain'
        title='Needs attention'
        contentClassName='gap-3'
      >
        {failed.map(app => (
          <Notice
            key={app.id}
            tone='danger'
            title={
              <Link
                className='underline underline-offset-4'
                href={`/app/${encodeURIComponent(app.id)}`}
              >
                {app.name}
              </Link>
            }
            description={
              app.statusDetail?.description ??
              app.statusMessage ??
              'Open this app to inspect the failure and available recovery actions.'
            }
          />
        ))}
        {pending.length ? (
          <p className='text-sm text-foreground-muted'>
            {pending.length} {pending.length === 1 ? 'app has an operation' : 'apps have operations'} in progress. Open
            an app to inspect its current stage.
          </p>
        ) : null}
      </Section>
    </div>
  )
}
