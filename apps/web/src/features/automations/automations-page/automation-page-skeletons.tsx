'use client'

import { useSearchParams } from 'next/navigation'
import { FormLoadingBoundary } from '@/components/ui/form-loading-boundary'
import { Skeleton } from '@/components/ui/skeleton'
import { AutomationEditorActions } from './editor/automation-editor-actions'
import { defaultForm } from './editor/builder-utils'
import { WorkflowEditorWorkspace } from './editor/workflow-editor-workspace'
import { AutomationsListPage } from './list/automations-list-page'
import { AutomationStepsList } from './steps/list/automation-steps-list'
import { AutomationTracesPage } from './traces/automation-traces-page'
import { AutomationTriggersPage } from './triggers/automation-triggers-page'

export const AutomationsListPageSkeleton = ({
  canManageHistoryRetention = false
}: {
  canManageHistoryRetention?: boolean
}) => {
  const q = useSearchParams()?.get('q')?.trim() || undefined

  return (
    <AutomationsListPage
      initialApplications={[]}
      automationsPage={{ items: [], total: 0, page: 1, pageSize: 20, facets: { tags: [], targetApplicationIds: [] } }}
      gridQuery={{ q }}
      canManageHistoryRetention={canManageHistoryRetention}
      loading
    />
  )
}

export const AutomationTriggersPageSkeleton = () => {
  const q = useSearchParams()?.get('q')?.trim() || undefined

  return (
    <AutomationTriggersPage
      initialApplications={[]}
      initialAutomations={[]}
      triggersPage={{ items: [], total: 0, page: 1, pageSize: 20, facets: { tags: [], targetApplicationIds: [] } }}
      gridQuery={{ q }}
      loading
    />
  )
}

const noop = () => undefined

export const AutomationCreatePageSkeleton = () => <AutomationEditorPageSkeleton creating />

export const AutomationEditorPageSkeleton = ({ creating = false }: { creating?: boolean }) => (
  <WorkflowEditorWorkspace
    title={
      creating ? (
        'New workflow'
      ) : (
        <>
          <span className='sm:hidden'>Workflow</span>
          <Skeleton className='hidden h-6 w-48 max-w-full sm:block' />
        </>
      )
    }
    actions={
      <AutomationEditorActions
        busy
        canDraftFromPrompt={false}
        canDelete={!creating}
        yamlOpen={false}
        yamlValid={false}
        onDelete={noop}
        onDraftFromPrompt={noop}
        onExport={noop}
        onImport={noop}
        onSave={noop}
        onToggleYaml={noop}
      />
    }
    yamlOpen={false}
    disabled
    onToggleYaml={noop}
  >
    <FormLoadingBoundary>
      <AutomationStepsList
        steps={defaultForm().steps}
        commands={[]}
        selectedStepKey='spec.steps[0]'
        openBlockKeys={[]}
        yamlStepKey={null}
        onSelectStep={noop}
        onToggleBlock={noop}
        onOpenBlock={noop}
        onYamlStepKeyChange={noop}
        onChange={noop}
        onStepChange={noop}
      />
    </FormLoadingBoundary>
  </WorkflowEditorWorkspace>
)

export const AutomationTracesPageSkeleton = () => {
  const run = useSearchParams().get('run')
  return (
    <AutomationTracesPage
      applications={[]}
      automation={null}
      runs={[]}
      selectedRunId={run ?? undefined}
      loading
    />
  )
}
