'use client'

import { IconPlus } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/shared/ui/page/page-header'
import { StandardPage } from '@/shared/ui/page/page-layout'
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
    <StandardPage className='gap-2'>
      <PageHeader
        breadcrumbs={[{ label: 'Automations' }, { label: 'Workflows' }]}
        title='Workflows'
        description='User-owned Android automation workflows.'
        actions={
          <Button asChild>
            <Link href='/automations/create'>
              <IconPlus className='size-4' />
              New flow
            </Link>
          </Button>
        }
      />

      {automationsPage.total === 0 &&
      !gridQuery.q &&
      !gridQuery.tag &&
      !gridQuery.targetApplicationId &&
      !gridQuery.status &&
      !gridQuery.lastRun ? (
        <AutomationEmptySplash variant='automations' />
      ) : (
        <section className='px-6 pb-16 pt-2 max-sm:px-4'>
          <AutomationsTable
            applications={initialApplications}
            automationsPage={automationsPage}
            gridQuery={gridQuery}
            triggers={initialTriggers}
          />
        </section>
      )}
    </StandardPage>
  )
}
