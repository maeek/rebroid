'use client'

import { IconPlus } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { AutomationEmptySplash } from '../shared/automation-empty-splash'
import { AutomationsTable } from './automations-table'
import { WorkflowHistoryRetentionControl } from './workflow-history-retention-control'
import type { AutomationsListPageProps } from '../editor/types'

export function AutomationsListPage({
  initialApplications,
  automationsPage,
  gridQuery,
  initialTriggers,
  workflowHistoryRetention,
  loading = false
}: AutomationsListPageProps) {
  return (
    <StandardPage
      gridToolbar
      className='gap-2'
    >
      <PageHeader
        section={{ label: 'Automations' }}
        title='Workflows'
        description='Create reusable workflows and review their latest execution.'
        actions={
          <>
            {workflowHistoryRetention ? <WorkflowHistoryRetentionControl initial={workflowHistoryRetention} /> : null}
            <Button
              asChild={!loading}
              disabled={loading}
            >
              {loading ? (
                <span>
                  <IconPlus className='size-4' />
                  New workflow
                </span>
              ) : (
                <Link href='/automations/create'>
                  <IconPlus className='size-4' />
                  New workflow
                </Link>
              )}
            </Button>
          </>
        }
      />

      {!loading &&
      automationsPage.total === 0 &&
      !gridQuery.q &&
      !gridQuery.tag &&
      !gridQuery.targetApplicationId &&
      !gridQuery.status &&
      !gridQuery.lastRun ? (
        <AutomationEmptySplash variant='automations' />
      ) : (
        <PageContent className='pt-2'>
          <AutomationsTable
            loading={loading}
            applications={initialApplications}
            automationsPage={automationsPage}
            gridQuery={gridQuery}
            triggers={initialTriggers}
          />
        </PageContent>
      )}
    </StandardPage>
  )
}
