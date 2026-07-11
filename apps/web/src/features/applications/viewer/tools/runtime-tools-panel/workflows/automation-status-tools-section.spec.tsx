import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { listActiveAutomationRunsAction } from '@/server/orchestrator/automations/automation-run-actions'
import { AutomationStatusToolsSection } from './automation-status-tools-section'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { AutomationRun, AutomationRunStatus } from '@/server/orchestrator/automations/types'

vi.mock('@/server/orchestrator/automations/automation-run-actions', () => ({
  listActiveAutomationRunsAction: vi.fn()
}))

vi.mock('@/features/applications/viewer/actions/app-automation-run-action', () => ({
  AppAutomationRunAction: () => <button type='button'>Run workflow</button>
}))

vi.mock('@/shared/ui/automation/automation-run-live-events', () => ({
  AutomationRunLiveEvents: ({
    run,
    onStatusChange
  }: {
    run: AutomationRun
    onStatusChange?: (status: AutomationRunStatus) => void
  }) => (
    <div>
      <span>Detail status: {run.status}</span>
      <button
        type='button'
        onClick={() => onStatusChange?.('failed')}
      >
        Emit failed
      </button>
    </div>
  )
}))

const app = {
  id: 'app_1',
  name: 'Demo',
  icon: null,
  running: false,
  status: 'stopped',
  lifecycleStage: 'stopped',
  statusMessage: null,
  statusDetail: null,
  ownerUserId: 'user_1',
  containerImage: 'redroid:13',
  containerName: 'rebroid-app-1',
  containerId: null,
  networkName: 'rebroid',
  volumeName: 'rebroid-app-1',
  profileName: null,
  memoryLimitMb: null,
  cpuLimitCpus: null,
  containerArgs: null,
  recreateContainerOnNextStart: false,
  networkPolicyEnabled: false,
  networkPolicyAllowCidrs: [],
  networkPolicyStatus: null,
  networkPolicyMessage: null,
  networkPolicyResult: null,
  networkPolicyAppliedAt: null,
  apkOriginalName: null,
  apkPackageName: null,
  apkFilePath: null,
  uploadedApkId: null,
  scrcpyTransport: 'webrtc',
  adbPort: 5555,
  inactivityTimeoutSeconds: 300,
  lastError: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  imagePullProgress: null,
  applicationError: null,
  apk: { version: '' },
  profileMode: 'temporary',
  savedProfiles: []
} satisfies AppDefinition

const run: AutomationRun = {
  id: 'run_1234567890',
  automationId: 'automation_1',
  automationTriggerId: null,
  ownerUserId: 'user_1',
  targetApplicationId: app.id,
  targetProfileMode: 'temporary',
  targetProfileName: null,
  trigger: 'manual',
  status: 'queued',
  startedAt: null,
  completedAt: null,
  stepResults: [],
  error: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}

describe('AutomationStatusToolsSection', () => {
  it('projects a live terminal status into the run list', async () => {
    vi.mocked(listActiveAutomationRunsAction).mockResolvedValue([])

    render(
      <AutomationStatusToolsSection
        app={app}
        latestRun={run}
      />
    )

    expect(await screen.findByText('Queued')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Emit failed' }))

    expect(await screen.findByText('Failed')).toBeTruthy()
    expect(screen.getByText('Detail status: failed')).toBeTruthy()
  })
})
