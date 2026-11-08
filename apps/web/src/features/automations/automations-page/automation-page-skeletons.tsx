'use client'

import { FormLoadingBoundary } from '@/components/ui/form-loading-boundary'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { AutomationDetailsSection } from './editor/automation-details-section'
import { AutomationEditorActions } from './editor/automation-editor-actions'
import { defaultForm } from './editor/builder-utils'
import { WorkflowEditorWorkspace } from './editor/workflow-editor-workspace'
import { AutomationsListPage } from './list/automations-list-page'
import { WorkflowResourceNavigation } from './shared/workflow-resource-navigation'
import { AutomationStepsList } from './steps/list/automation-steps-list'
import { AutomationTracesPage } from './traces/automation-traces-page'
import { AutomationTriggersPage } from './triggers/automation-triggers-page'

export const AutomationsListPageSkeleton = () => (
  <AutomationsListPage
    initialApplications={[]}
    initialTriggers={[]}
    automationsPage={{ items: [], total: 0, page: 1, pageSize: 20, facets: { tags: [], targetApplicationIds: [] } }}
    gridQuery={{}}
    loading
  />
)

export const AutomationTriggersPageSkeleton = () => (
  <AutomationTriggersPage
    initialApplications={[]}
    initialAutomations={[]}
    triggersPage={{ items: [], total: 0, page: 1, pageSize: 20, facets: { tags: [], targetApplicationIds: [] } }}
    gridQuery={{}}
    loading
  />
)

const noop = () => undefined

export const AutomationCreatePageSkeleton = () => <AutomationEditorPageSkeleton creating />

export const AutomationEditorPageSkeleton = ({ creating = false }: { creating?: boolean }) => (
  <StandardPage className='gap-0'>
    <PageHeader
      section={{ label: 'Automations' }}
      trail={[{ label: 'Workflows', href: '/automations' }]}
      title={creating ? 'New workflow' : <Skeleton className='h-9 w-48' />}
      breadcrumbLabel={creating ? 'New workflow' : 'Workflow'}
      description={creating ? 'Create a reusable workflow.' : 'Edit workflow steps, settings, and execution behavior.'}
      actions={
        <div
          inert
          className='contents'
        >
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
          />
        </div>
      }
    />
    <PageContent className='grid gap-6 pt-2'>
      {!creating ? (
        <WorkflowResourceNavigation
          active='editor'
          loading
        />
      ) : null}
      <WorkflowEditorWorkspace
        details={
          <FormLoadingBoundary>
            <AutomationDetailsSection
              form={defaultForm()}
              onChange={noop}
            />
          </FormLoadingBoundary>
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
    </PageContent>
  </StandardPage>
)

export const AutomationTracesPageSkeleton = () => (
  <AutomationTracesPage
    applications={[]}
    automation={null}
    runs={[]}
    loading
  />
)
