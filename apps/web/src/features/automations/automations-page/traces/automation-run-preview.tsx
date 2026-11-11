import { applicationPreview } from '@/shared/testing/application-preview'
import { previewWorkflow } from '@/shared/testing/automation-preview'
import { AutomationTracesPage } from './automation-traces-page'
import type { AutomationRun } from '@/shared/contracts/automation'
const run: AutomationRun = {
  id: 'preview-run',
  automationId: 'preview-workflow',
  automationTriggerId: null,
  ownerUserId: 'preview-owner',
  targetApplicationId: 'preview-app',
  targetProfileMode: 'persistent',
  targetProfileName: 'default',
  trigger: 'manual',
  status: 'failed',
  startedAt: '2026-11-07T10:00:00Z',
  completedAt: '2026-11-07T10:01:00Z',
  createdAt: '2026-11-07T10:00:00Z',
  updatedAt: '2026-11-07T10:01:00Z',
  error: 'Target app did not finish starting.',
  failureRequestId: 'preview-authorization-request',
  stepResults: [
    {
      stepId: 'launch',
      uses: 'android.launchApp',
      status: 'failed',
      startedAt: '2026-11-07T10:00:00Z',
      completedAt: '2026-11-07T10:01:00Z',
      output: null,
      error: 'Android boot timed out.'
    }
  ]
}
export const AutomationRunPreview = () => (
  <AutomationTracesPage
    applications={[applicationPreview]}
    automation={previewWorkflow}
    runs={[run]}
    selectedRunId={run.id}
  />
)
