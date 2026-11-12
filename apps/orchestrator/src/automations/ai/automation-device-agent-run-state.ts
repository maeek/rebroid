import type {
  AutomationObservedScreen,
  AutomationScreenObservation,
} from '../vision/automation-vision.types';
import type { VisionDetection } from '../vision/vision-observation';
import type { AiObservationCandidate } from './core/screen-state-policy';
import type { DeviceTargetSession } from './automation-device-target-session';
import { sanitizeAiText } from './automation-ai-observation.utils';
import type { AutomationCommandOutcome } from '@rebroid/automation-core/command-registry';

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
  lookupMatches?: AiObservationCandidate[];
  outcome?: AutomationCommandOutcome;
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

export class DeviceAgentRunState implements DeviceAgentState {
  private readonly history: DeviceAgentTrajectoryEntry[] = [];
  private readonly evidenceLog: DeviceAgentEvidence[];
  private goals: readonly DeviceAgentSubgoal[] = [];
  private actionCount = 0;
  private failureCount = 0;
  private planningCount = 0;
  private lookupMatches: AiObservationCandidate[] = [];

  constructor(
    readonly target: DeviceTargetSession,
    private screen: AutomationObservedScreen,
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

  observationForAction(): AutomationScreenObservation {
    return {
      ...this.observation,
      candidates: [...this.observation.candidates, ...this.lookupMatches],
    };
  }

  admitLookupMatches({
    snapshotId,
    matches,
  }: {
    snapshotId: string;
    matches: VisionDetection[];
  }) {
    if (snapshotId !== this.observation.snapshotId) return [];
    const candidates = matches
      .slice(0, 5)
      .flatMap((match, index): AiObservationCandidate[] => {
        if (
          match.source === 'cv' ||
          match.bounds.width <= 0 ||
          match.bounds.height <= 0
        ) {
          return [];
        }
        const label = sanitizeAiText(
          match.label ?? match.text ?? match.description ?? '',
          120,
        );
        if (!label) return [];
        return [
          {
            id: `lookup-${this.actionCount}-${index + 1}`,
            label,
            source: match.source,
            confidence: match.confidence,
            bounds: match.bounds,
            ...(match.role ? { role: match.role } : {}),
          },
        ];
      });
    this.lookupMatches = [...this.lookupMatches, ...candidates].slice(-20);
    return candidates;
  }

  controllerEvidence() {
    return this.evidenceLog
      .slice(-12)
      .reverse()
      .flatMap((item) => {
        if (item.kind === 'snapshot')
          return [`- Observed screen [evidence=${item.id}]`];
        if (
          item.eligibleForCompletion &&
          item.snapshotId === this.observation.snapshotId
        ) {
          if (item.command === 'vision.locate')
            return this.lookupEvidence(item);
          if (item.command === 'vision.observe') return this.ocrEvidence(item);
        }
        return item.eligibleForCompletion ? this.typedResultEvidence(item) : [];
      });
  }

  private typedResultEvidence({
    command,
    data,
    id,
    outcome,
  }: DeviceAgentEvidence) {
    const fact = (text: string) => [`- ${text} [evidence=${id}]`];
    switch (command) {
      case 'android.listPackages': {
        if (outcome === 'not_found')
          return fact('Package discovery returned no matches.');
        if (!Array.isArray(data?.packages)) return [];
        const names = data.packages
          .filter(
            (name): name is string =>
              typeof name === 'string' && /^[A-Za-z0-9_.]{1,160}$/.test(name),
          )
          .slice(0, 30);
        return names.length
          ? fact(`Observed package IDs: ${names.join(', ')}`)
          : [];
      }
      case 'android.getClipboard':
        return typeof data?.text === 'string'
          ? fact(
              `Clipboard text: ${JSON.stringify(sanitizeAiText(data.text, 300))}`,
            )
          : [];
      case 'android.getSetting':
        return typeof data?.value === 'string'
          ? fact(
              `Android setting value: ${JSON.stringify(sanitizeAiText(data.value, 300))}`,
            )
          : [];
      case 'android.fileExists':
        return typeof data?.exists === 'boolean'
          ? fact(`Device file exists: ${data.exists}`)
          : [];
      case 'android.listFiles': {
        if (!Array.isArray(data?.files)) return [];
        const names = data.files.filter(
          (name): name is string => typeof name === 'string',
        );
        if (!names.length)
          return fact('The device directory contains no listed files.');
        const entries = names
          .slice(0, 30)
          .map((name) => sanitizeAiText(name, 160));
        return fact(
          `Device files (${entries.length} of ${names.length}): ${JSON.stringify(entries)}`,
        );
      }
      case 'android.pullFile':
        return typeof data?.sizeBytes === 'number'
          ? fact(`Read ${data.sizeBytes} bytes from the device file.`)
          : [];
      default:
        return [];
    }
  }

  private lookupEvidence(item: DeviceAgentEvidence) {
    if (item.data?.outcome === 'not_found') {
      return [
        `- Screen lookup found no match in available evidence [evidence=${item.id}]`,
      ];
    }
    return (item.lookupMatches ?? [])
      .filter((match) => this.lookupMatches.includes(match))
      .map((match) => {
        const bounds = match.bounds
          ? [
              match.bounds.left,
              match.bounds.top,
              match.bounds.width,
              match.bounds.height,
            ]
              .map((value) => value.toFixed(3))
              .join(',')
          : 'none';
        return `- ${match.id} | ${JSON.stringify(match.label)} | source=${match.source} | confidence=${match.confidence.toFixed(2)} | bounds=${bounds} [evidence=${item.id}]`;
      });
  }

  private ocrEvidence(item: DeviceAgentEvidence) {
    const { ocrStatus, ocrTextCount, ocrDetections } = item.data ?? {};
    if (typeof ocrStatus !== 'string' || typeof ocrTextCount !== 'number')
      return [];
    const labels = Array.isArray(ocrDetections)
      ? ocrDetections.slice(0, 8).flatMap((entry) => {
          const label: unknown = entry?.text;
          return typeof label === 'string' ? [sanitizeAiText(label, 120)] : [];
        })
      : [];
    return [
      `- OCR ${ocrStatus}, ${ocrTextCount} text boxes: ${JSON.stringify(labels)} [evidence=${item.id}]`,
    ];
  }

  beginAction() {
    this.actionCount += 1;
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
    screen?: AutomationObservedScreen,
  ) {
    if (screen) {
      this.lookupMatches = [];
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
      outcome: evidence.outcome
        ? `[${evidence.outcome}] ${evidence.summary}`
        : evidence.summary,
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
