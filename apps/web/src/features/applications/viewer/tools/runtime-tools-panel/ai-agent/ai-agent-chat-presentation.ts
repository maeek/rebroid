import type { ChatTurn, ChatTurnStatus } from './ai-agent-chat-utils'
import type { AutomationRunEvent } from '@/shared/contracts/automation'

export type AgentPlanStepStatus = 'pending' | 'active' | 'completed'

export interface AgentPlanStep {
  id: string
  label: string
  evidence: string | null
  status: AgentPlanStepStatus
}

const structuredPlanLine = /^\s*-\s*\[(pending|completed)\]\s+([^:]+):\s+(.+?)(?:\s+\(evidence:\s*(.+)\))?\s*$/i
const markdownPlanLine = /^\s*(?:[-*]|\d+[.)])\s+(?:\*\*)?([^:*]+)(?:\*\*)?:?\s*(.+)?$/

export const latestPlanEvent = (events: AutomationRunEvent[]) =>
  [...events].reverse().find(event => event.type === 'ai.plan.proposed' || event.type === 'ai.plan.updated') ?? null

export const parseAgentPlan = (message: string, turnStatus: ChatTurnStatus): AgentPlanStep[] => {
  const steps = message.split(/\r?\n/).flatMap((line, index) => {
    const structured = line.match(structuredPlanLine)
    if (structured) {
      return [
        {
          id: structured[2]?.trim() || `step-${index + 1}`,
          label: structured[3]?.trim() || 'Continue the task',
          evidence: structured[4]?.trim() || null,
          status: structured[1]?.toLowerCase() === 'completed' ? ('completed' as const) : ('pending' as const)
        }
      ]
    }
    const markdown = line.match(markdownPlanLine)
    if (!markdown) return []
    const title = markdown[1]?.trim()
    const detail = markdown[2]?.trim()
    const label = [title, detail].filter(Boolean).join(': ')
    if (!label) return []
    return [{ id: `step-${index + 1}`, label, evidence: null, status: 'pending' as const }]
  })

  if (turnStatus === 'success') {
    return steps.map(step => ({ ...step, status: 'completed' }))
  }
  if (turnStatus === 'running' || turnStatus === 'starting' || turnStatus === 'canceling') {
    const firstPending = steps.findIndex(step => step.status === 'pending')
    if (firstPending >= 0) {
      return steps.map((step, index) => (index === firstPending ? { ...step, status: 'active' } : step))
    }
  }
  return steps
}

export const planForTurn = (turn: ChatTurn) => {
  const event = latestPlanEvent(turn.events)
  return event ? { event, steps: parseAgentPlan(event.message, turn.status) } : null
}

export const nonPlanEvents = (events: AutomationRunEvent[]) => {
  const hasFusedPerception = events.some(event => event.type === 'ai.perception.observed')
  return events.filter(event => {
    if (event.type === 'ai.plan.proposed' || event.type === 'ai.plan.updated') return false
    if (hasFusedPerception && (event.type === 'ai.screenshot.observed' || event.type === 'ai.ui.observed')) return false
    return true
  })
}

export const generationSummary = (event: AutomationRunEvent) => {
  if (event.type !== 'ai.model.completed') return null
  const reasoningPresent = event.data.reasoningPresent === true
  const usage = record(event.data.usage)
  const timings = record(event.data.timings)
  const completionTokens = finiteNumber(usage?.completionTokens)
  const predictedMs = finiteNumber(timings?.predictedMs)
  const details = [
    predictedMs === null ? null : `${formatDuration(predictedMs)}`,
    completionTokens === null ? null : `${completionTokens} output tokens`
  ].filter((value): value is string => Boolean(value))
  return {
    label: reasoningPresent ? 'Reasoned about the next step' : 'Prepared the next step',
    details
  }
}

export const approvalRequestFromEvent = (event: AutomationRunEvent) => {
  if (event.type !== 'ai.guardrail.triggered' || typeof event.data.program !== 'string') return null
  return {
    id: event.id,
    program: event.data.program,
    reason: event.message
  }
}

const record = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null

const finiteNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null)

const formatDuration = (milliseconds: number) =>
  milliseconds < 1000 ? `${Math.round(milliseconds)}ms` : `${(milliseconds / 1000).toFixed(1)}s`
