'use client'

import { IconPlus } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SettingsActionButton } from '@/shared/ui/actions/settings-action-button'
import { CompactPageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { AutomationsTable } from './automations-table'
import { WorkflowHistoryRetentionControl } from './workflow-history-retention-control'
import type { AutomationsListPageProps } from '../editor/types'

export function AutomationsListPage({
  initialApplications,
  automationsPage,
  gridQuery,
  workflowHistoryRetention,
  canManageHistoryRetention = false,
  loading = false
}: AutomationsListPageProps) {
  const createLabel = (
    <>
      <IconPlus className='size-4' />
      New workflow
    </>
  )

  return (
    <StandardPage
      gridToolbar
      className='gap-2'
    >
      <CompactPageHeader
        section={{ label: 'Automations' }}
        title='Workflows'
        description='Create reusable workflows and review their latest execution.'
        actions={
          <>
            {workflowHistoryRetention ? <WorkflowHistoryRetentionControl initial={workflowHistoryRetention} /> : null}
            {loading && canManageHistoryRetention ? (
              <SettingsActionButton
                label='Run history retention'
                className='sm:hidden'
                disabled
              />
            ) : null}
            {loading ? (
              <Button disabled>{createLabel}</Button>
            ) : (
              <Button asChild>
                <Link href='/automations/create'>{createLabel}</Link>
              </Button>
            )}
          </>
        }
      />

      <PageContent className='pt-2'>
        <AutomationsTable
          loading={loading}
          applications={initialApplications}
          automationsPage={automationsPage}
          gridQuery={gridQuery}
        />
      </PageContent>
    </StandardPage>
  )
}
