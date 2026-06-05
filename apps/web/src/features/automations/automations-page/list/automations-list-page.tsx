import { IconPlus } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PageBreadcrumbs } from '@/features/shell/components/page-breadcrumbs'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { AutomationEmptySplash } from '../shared/automation-empty-splash'
import { AutomationsTable } from './automations-table'
import type { AutomationsListPageProps } from '../editor/types'

export function AutomationsListPage({
  initialApplications,
  automationsPage,
  gridQuery,
  initialTriggers
}: AutomationsListPageProps) {
  return (
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <section className='shrink-0 px-6 py-4 max-sm:px-4'>
        <div className='grid gap-3'>
          <PageBreadcrumbs
            className='pt-0'
            items={[{ label: 'Automations' }, { label: 'Workflows' }]}
          />
          <div className='flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start'>
            <div className='grid gap-2'>
              <h2 className='text-3xl font-medium max-sm:text-xl'>Workflows</h2>
              <p className='max-w-3xl text-sm text-secondary-foreground'>User-owned Android automation workflows.</p>
            </div>
            <Button
              asChild
              className='max-sm:w-full'
            >
              <Link href='/automations/create'>
                <IconPlus className='size-4' />
                New flow
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {automationsPage.total === 0 &&
      !gridQuery.q &&
      !gridQuery.tag &&
      !gridQuery.targetApplicationId &&
      !gridQuery.status &&
      !gridQuery.lastRun ? (
        <AutomationEmptySplash variant='automations' />
      ) : (
        <section className='px-6 pb-16 pt-4 max-sm:px-4'>
          <AutomationsTable
            applications={initialApplications}
            automationsPage={automationsPage}
            gridQuery={gridQuery}
            triggers={initialTriggers}
          />
        </section>
      )}
    </ProtectedStackPageLayout>
  )
}
