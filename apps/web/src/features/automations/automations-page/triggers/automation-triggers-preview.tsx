import { applicationPreview } from '@/shared/testing/application-preview'
import { previewWorkflow } from '@/shared/testing/automation-preview'
import { AutomationTriggersPage } from './automation-triggers-page'
import type { AutomationTrigger } from '@/shared/contracts/automation'

export const previewTrigger: AutomationTrigger = {
  id: 'preview-trigger',
  name: 'Morning inventory',
  description: 'Check stock levels before the morning shift.',
  ownerUserId: 'preview-owner',
  automationId: previewWorkflow.id,
  targetApplicationId: applicationPreview.id,
  profileMode: 'persistent',
  profileName: 'default',
  enabled: true,
  tags: [{ name: 'nightly', color: '#64748b' }],
  triggerType: 'schedule',
  triggerConfig: { cronExpression: '0 9 * * *', startPolicy: 'start-if-needed' },
  lastRunAt: null,
  nextRunAt: '2026-11-08T09:00:00Z',
  lastStatus: 'never_run',
  lastError: null,
  createdAt: '2026-11-07T10:00:00Z',
  updatedAt: '2026-11-07T10:00:00Z'
}
export const AutomationTriggersPreview = () => (
  <AutomationTriggersPage
    initialApplications={[applicationPreview, { ...applicationPreview, id: 'reports-app', name: 'Reports worker' }]}
    initialAutomations={[
      {
        ...previewWorkflow,
        description: 'Read stock levels and report shortages.',
        tags: [{ name: 'inventory', color: '#2563eb' }]
      },
      { ...previewWorkflow, id: 'warehouse-workflow', description: 'Reconcile warehouse inventory before opening.' }
    ]}
    triggersPage={{
      items: [previewTrigger],
      total: 1,
      page: 1,
      pageSize: 20,
      facets: { tags: ['nightly', 'smoke'], targetApplicationIds: [applicationPreview.id] }
    }}
    gridQuery={{}}
  />
)
