import { describe, expect, it } from 'vitest'
import { approvalRequestFromEvent, generationSummary, parseAgentPlan, planForTurn } from './ai-agent-chat-presentation'
import type { AutomationRunEvent, AutomationRunEventType } from '@/shared/contracts/automation'

const event = (
  type: AutomationRunEventType,
  message: string,
  data: Record<string, unknown> = {}
): AutomationRunEvent => ({
  id: `${type}-1`,
  runId: 'run-1',
  ownerUserId: 'owner-1',
  sequence: 1,
  type,
  stepId: null,
  parentStepId: null,
  message,
  data,
  createdAt: '2026-01-01T00:00:00.000Z'
})

describe('AI agent chat presentation', () => {
  it('turns harness subgoals into an active task list', () => {
    expect(
      parseAgentPlan(
        '- [pending] open-settings: Open Settings (evidence: Settings title is visible)\n- [pending] verify: Verify dark mode',
        'running'
      )
    ).toEqual([
      {
        id: 'open-settings',
        label: 'Open Settings',
        evidence: 'Settings title is visible',
        status: 'active'
      },
      { id: 'verify', label: 'Verify dark mode', evidence: null, status: 'pending' }
    ])
  })

  it('uses the agent outcome when the automation finishes', () => {
    const plan = event('ai.plan.updated', '- [completed] open: Open search\n- [pending] reserve: Reserve parking')
    const turn = { id: 'turn', prompt: 'Reserve parking', status: 'success' as const, run: null }
    const steps = (events: AutomationRunEvent[]) => planForTurn({ ...turn, events })?.steps.map(step => step.status)
    const blocked = event('ai.message.completed', 'Blocked', { status: 'blocked', completed: false })
    const completed = event('ai.message.completed', 'Reserved', { status: 'completed', completed: true })
    const ended = event('run.completed', 'Automation completed.')
    expect(steps([plan, blocked, ended])).toEqual(['completed', 'pending'])
    expect(steps([plan, ended])).toEqual(['completed', 'pending'])
    expect(steps([plan, completed, ended])).toEqual(['completed', 'completed'])
  })

  it('summarizes reasoning metadata without exposing hidden chain of thought', () => {
    expect(
      generationSummary(
        event('ai.model.completed', 'Controller turn completed.', {
          reasoningPresent: true,
          usage: { completionTokens: 42 },
          timings: { predictedMs: 1250 }
        })
      )
    ).toEqual({ label: 'Reasoned about the next step', details: ['1.3s', '42 output tokens'] })
  })

  it('only offers approval for a guardrail carrying a requested program', () => {
    expect(
      approvalRequestFromEvent(
        event('ai.guardrail.triggered', 'Raw ADB shell is disabled for this run.', { program: 'getprop' })
      )
    ).toEqual({
      id: 'ai.guardrail.triggered-1',
      program: 'getprop',
      reason: 'Raw ADB shell is disabled for this run.'
    })
    expect(approvalRequestFromEvent(event('ai.guardrail.triggered', 'Stale snapshot.'))).toBeNull()
  })
})
