import type { DeviceAgentDecision } from './core/device-decision';
import type {
  DeviceAgentState,
  DeviceAgentSubgoal,
} from './automation-device-agent-state';

type FinishDecision = Extract<DeviceAgentDecision, { kind: 'finish' }>;
type FinishVerification =
  { ok: true; subgoals: DeviceAgentSubgoal[] } | { ok: false; reason: string };

export const verifyAutomationAiFinish = (
  decision: FinishDecision,
  state: DeviceAgentState,
): FinishVerification => {
  const knownEvidence = new Set(state.evidence.map((evidence) => evidence.id));
  const unknownEvidence = decision.evidenceIds.filter(
    (evidenceId) => !knownEvidence.has(evidenceId),
  );
  if (unknownEvidence.length > 0) {
    return {
      ok: false,
      reason: `Completion referenced unknown evidence: ${unknownEvidence.join(', ')}.`,
    };
  }
  if (decision.status === 'completed' && decision.evidenceIds.length === 0) {
    return {
      ok: false,
      reason: 'Completed status requires observed evidence.',
    };
  }

  const knownSubgoals = new Set(state.subgoals.map((subgoal) => subgoal.id));
  if (
    decision.completedSubgoalIds.some(
      (subgoalId) => !knownSubgoals.has(subgoalId),
    )
  ) {
    return { ok: false, reason: 'Completion referenced an unknown subgoal.' };
  }
  if (
    decision.status === 'completed' &&
    state.subgoals.some(
      (subgoal) => !decision.completedSubgoalIds.includes(subgoal.id),
    )
  ) {
    return { ok: false, reason: 'Not all planned subgoals were completed.' };
  }

  return {
    ok: true,
    subgoals: state.subgoals.map((subgoal) => ({
      ...subgoal,
      status: decision.completedSubgoalIds.includes(subgoal.id)
        ? 'completed'
        : subgoal.status,
    })),
  };
};
