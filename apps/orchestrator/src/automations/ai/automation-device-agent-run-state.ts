import type { AutomationScreenObservation } from '../vision/automation-vision.types';
import type { DeviceTargetSession } from './automation-device-agent-state';

export interface DeviceAgentSubgoal {
  id: string;
  goal: string;
  successEvidence: string;
  status: 'pending' | 'completed';
}

export interface DeviceAgentEvidence {
  id: string;
  kind: 'snapshot' | 'action' | 'typed-result';
  summary: string;
  snapshotId?: string;
  data?: Record<string, unknown>;
  eligibleForCompletion?: boolean;
  command?: string;
}

export interface DeviceAgentTrajectoryEntry {
  action: string;
  outcome: string;
  evidenceId: string;
  snapshotId?: string;
  failed: boolean;
}

export interface DeviceAgentState {
  readonly target: DeviceTargetSession;
  readonly observation: AutomationScreenObservation;
  readonly plannerText: string;
  readonly subgoals: readonly DeviceAgentSubgoal[];
  readonly evidence: readonly DeviceAgentEvidence[];
  readonly trajectory: readonly DeviceAgentTrajectoryEntry[];
  readonly actions: number;
  readonly consecutiveFailures: number;
  readonly planAttempts: number;
}

type ObservedScreen = {
  observation: AutomationScreenObservation;
  plannerText: string;
};

export class DeviceAgentRunState implements DeviceAgentState {
  private readonly history: DeviceAgentTrajectoryEntry[] = [];
  private readonly evidenceLog: DeviceAgentEvidence[];
  private goals: readonly DeviceAgentSubgoal[] = [];
  private actionCount = 0;
  private failureCount = 0;
  private planningCount = 0;

  constructor(
    readonly target: DeviceTargetSession,
    private screen: ObservedScreen,
  ) {
    const { snapshotId, summary } = screen.observation;
    this.evidenceLog = [
      {
        id: `snapshot:${snapshotId}`,
        kind: 'snapshot',
        summary: summary ?? 'Initial device snapshot captured.',
        snapshotId,
      },
    ];
  }

  get observation() {
    return this.screen.observation;
  }
  get plannerText() {
    return this.screen.plannerText;
  }
  get subgoals() {
    return this.goals;
  }
  get evidence(): readonly DeviceAgentEvidence[] {
    return this.evidenceLog;
  }
  get trajectory(): readonly DeviceAgentTrajectoryEntry[] {
    return this.history;
  }
  get actions() {
    return this.actionCount;
  }
  get consecutiveFailures() {
    return this.failureCount;
  }
  get planAttempts() {
    return this.planningCount;
  }

  controllerEvidence() {
    return this.evidenceLog
      .slice(-12)
      .reverse()
      .flatMap((item) => {
        if (item.kind === 'snapshot')
          return [`- Observed screen [evidence=${item.id}]`];
        if (
          !item.eligibleForCompletion ||
          item.command !== 'android.listPackages'
        )
          return [];
        const packages: unknown = item.data?.packages;
        if (!Array.isArray(packages)) return [];
        const names = packages
          .filter(
            (name): name is string =>
              typeof name === 'string' && /^[A-Za-z0-9_.]{1,160}$/.test(name),
          )
          .slice(0, 30);
        return names.length
          ? [
              `- Observed package IDs: ${names.join(', ')} [evidence=${item.id}]`,
            ]
          : [];
      });
  }

  beginAction() {
    this.actionCount += 1;
    return this.actionCount;
  }

  beginPlan() {
    this.planningCount += 1;
    return this.planningCount;
  }

  setSubgoals(subgoals: readonly DeviceAgentSubgoal[]) {
    this.goals = subgoals;
  }

  recordAction(
    action: string,
    result: Omit<DeviceAgentEvidence, 'id'>,
    failed: boolean,
    screen?: ObservedScreen,
  ) {
    if (screen) {
      this.screen = screen;
      const { snapshotId, summary } = screen.observation;
      if (
        !this.evidenceLog.some((item) => item.id === `snapshot:${snapshotId}`)
      ) {
        this.evidenceLog.push({
          id: `snapshot:${snapshotId}`,
          kind: 'snapshot',
          summary: summary ?? 'Screen observed after action.',
          snapshotId,
        });
      }
    }
    const evidence = {
      ...result,
      id: `action:${this.actionCount}`,
      eligibleForCompletion: !failed,
    };
    this.evidenceLog.push(evidence);
    this.history.push({
      action,
      outcome: evidence.summary,
      evidenceId: evidence.id,
      snapshotId: evidence.snapshotId,
      failed,
    });
    this.failureCount = failed ? this.failureCount + 1 : 0;
    return evidence;
  }

  recordRejectedDecision(action: string, outcome: string, countFailure = true) {
    this.history.push({
      action,
      outcome,
      evidenceId: this.evidenceLog[0].id,
      failed: true,
    });
    if (countFailure) this.failureCount += 1;
  }
}
