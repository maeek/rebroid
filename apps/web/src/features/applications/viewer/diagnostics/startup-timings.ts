import type { AppDefinition } from '@/features/applications/domain/app-definition'

export type StartupMilestone = { label: string; at: number | null }
export type StartupTimings = { milestones: StartupMilestone[]; baseline: number | null; firstFrameAt: number | null }

export const startupRuntimeKey = (app?: AppDefinition) =>
  app?.containerId
    ? `${app.id}:${app.containerId}:${app.provisioningStartedAt?.getTime() ?? app.lastStartedAt?.getTime() ?? 0}`
    : null

const eventLabels: Record<string, string> = {
  'Lifecycle stage: container_creating': 'Container creation started',
  'Container created': 'Container created',
  'Container created for start': 'Container created',
  'Lifecycle stage: container_starting': 'Container start requested',
  'Container start requested': 'Container started',
  'Android boot completed': 'Android ready',
  'Android network attachment completed': 'Display network attached',
  'Prepared Android remote access': 'ADB ready',
  'Lifecycle stage: ready': 'App ready'
}

export const readStartupTimings = (
  app: AppDefinition,
  output: string | undefined,
  firstFrameAt?: number
): StartupTimings => {
  const attemptStart = app.provisioningStartedAt?.getTime() ?? app.lastStartedAt?.getTime()
  const observations = new Map<string, number>()
  if (attemptStart !== undefined && Number.isFinite(attemptStart)) {
    for (const line of (output ?? '').split('\n')) {
      const timestampEnd = line.indexOf(' ')
      const at = Date.parse(line.slice(0, timestampEnd))
      if (!Number.isFinite(at) || at < attemptStart) continue
      const payloadAt = line.indexOf(' {', timestampEnd)
      const message = line.slice(timestampEnd + 1, payloadAt < 0 ? undefined : payloadAt)
      const label = Object.hasOwn(eventLabels, message) ? eventLabels[message] : undefined
      if (!label || observations.has(label)) continue
      try {
        const context: unknown = payloadAt < 0 ? {} : JSON.parse(line.slice(payloadAt + 1))
        if (!context || typeof context !== 'object' || Array.isArray(context)) continue
        const details = context as Record<string, unknown>
        if (typeof details.containerId === 'string' && details.containerId !== app.containerId) continue
        if (message === 'Android network attachment completed' && details.outcome !== 'connected') continue
        observations.set(label, at)
      } catch {
        // A truncated or malformed log line cannot establish a milestone.
      }
    }
  }
  const baseline =
    observations.get('Container creation started') ?? observations.get('Container start requested') ?? null
  const frameAt =
    firstFrameAt !== undefined &&
    Number.isFinite(new Date(firstFrameAt).getTime()) &&
    attemptStart !== undefined &&
    firstFrameAt >= attemptStart
      ? firstFrameAt
      : null
  const milestones: StartupMilestone[] = [...observations].map(([label, at]) => ({ label, at }))
  milestones.sort((left, right) => left.at! - right.at!)
  milestones.push({ label: 'First frame in this tab', at: frameAt })
  return { milestones, baseline, firstFrameAt: frameAt }
}

export const startupElapsed = (milliseconds: number) => {
  if (milliseconds < 0) return 'Not available'
  if (milliseconds < 60_000) return `${(milliseconds / 1000).toFixed(1)} s`
  return `${Math.floor(milliseconds / 60_000)} min ${((milliseconds % 60_000) / 1000).toFixed(1)} s`
}
