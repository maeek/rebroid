'use client'

import { useState } from 'react'
import { Section } from '@/components/ui/section'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridEmptyState } from '@/shared/ui/data-grid/data-grid-empty-state'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { StateView } from '@/shared/ui/state-view'

export const FeedbackPreview = () => {
  const [search, setSearch] = useState('missing')
  const [failed, setFailed] = useState(true)
  return (
    <StandardPage>
      <PageHeader title='Feedback preview' />
      <PageContent>
        <Section
          surface='panel'
          title='Quotas'
        >
          <StateView
            kind='not-applicable'
            title='Unlimited quotas'
            description='The Administrators group grants unlimited quotas.'
          />
        </Section>
        <Section
          surface='panel'
          title='Operation limits'
        >
          {failed ? (
            <StateView
              kind='unavailable'
              title='Settings unavailable'
              description='Could not load the current settings.'
              requestId='preview-request'
              actions={[{ label: 'Try again', onClick: () => setFailed(false) }]}
            />
          ) : (
            <p>Settings loaded</p>
          )}
        </Section>
        <DataGridWorkspace
          search={search}
          searchPlaceholder='Search models'
          onSearchChange={setSearch}
          onSearch={setSearch}
        >
          <DataGrid
            columns={[
              { accessorKey: 'name', header: 'Model', size: 320 },
              { accessorKey: 'provider', header: 'Provider', size: 640 }
            ]}
            data={[] as { id: string; name: string; provider: string }[]}
            totalItems={0}
            pageIndex={0}
            pageSize={20}
            getRowId={row => row.id}
            minWidth='60rem'
            emptyState={
              <DataGridEmptyState
                title='No models added'
                description='Add a model from this provider to use it for automation.'
              />
            }
          />
        </DataGridWorkspace>
      </PageContent>
    </StandardPage>
  )
}
