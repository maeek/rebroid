import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AutomationRunInspector } from './automation-run-inspector'
import type { AutomationRun } from '@/shared/contracts/automation'
vi.mock('@/shared/ui/automation/automation-run-live-events', () => ({
  AutomationRunLiveEvents: () => <div>Recorded event history</div>
}))
const run: AutomationRun = {
  id: 'run-12345678',
  automationId: 'workflow-1',
  automationTriggerId: null,
  ownerUserId: 'owner',
  targetApplicationId: 'app-1',
  targetProfileMode: 'persistent',
  targetProfileName: 'default',
  trigger: 'manual',
  status: 'failed',
  startedAt: null,
  completedAt: null,
  error: 'Target app unavailable',
  stepResults: [
    {
      stepId: 'launch',
      uses: 'android.launchApp',
      status: 'failed',
      startedAt: '2026-11-07T12:00:00Z',
      completedAt: '2026-11-07T12:00:01Z',
      error: 'Package not installed',
      output: null
    }
  ],
  createdAt: '2026-11-07T12:00:00Z',
  updatedAt: '2026-11-07T12:00:01Z'
}
describe('AutomationRunInspector', () => {
  it('shows persisted failure evidence and resource destinations', () => {
    render(
      <AutomationRunInspector
        run={run}
        targetName='Example app'
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('Target app unavailable')).toBeTruthy()
    expect(screen.getByText('Package not installed')).toBeTruthy()
    expect(screen.getByText('Recorded event history')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Inspect target app' })).toHaveAttribute('href', '/app/app-1')
    expect(screen.getByRole('link', { name: 'Open workflow' })).toHaveAttribute('href', '/automations/workflow-1')
  })
})
