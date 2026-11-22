import { headers } from 'next/headers'
import 'server-only'
import { requireAutomationUser } from '@/server/orchestrator/automations/action-helpers'
import { orchestratorAutomationsClient } from '@/server/orchestrator/automations/client'
import { getOrchestratorBrowserWsUrl } from '@/server/orchestrator/config'

export const readAutomationRunEvents = async (runId: string, after: number, signal: AbortSignal) => {
  const user = await requireAutomationUser('automations:run', 'api')
  return orchestratorAutomationsClient.listRunEventPage(user.ownerUserId, runId, after, signal)
}

export const subscribeToAutomationRunEvents = async (runId: string, after: number, signal: AbortSignal) => {
  const user = await requireAutomationUser('automations:run', 'api')
  const token = await orchestratorAutomationsClient.createRunEventStreamToken(user.ownerUserId, runId, signal)
  const query = new URLSearchParams({ token: token.token, after: String(after) })
  const requestHeaders = await headers()
  const isHttps =
    requestHeaders.get('x-forwarded-proto')?.split(',')[0]?.trim() === 'https' ||
    requestHeaders.get('x-forwarded-ssl') === 'on' ||
    requestHeaders.get('origin')?.startsWith('https://') === true
  const forwardedHost = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  const origin = requestHeaders.get('origin')
  const browserOrigin = origin?.startsWith('https://')
    ? origin
    : isHttps && forwardedHost
      ? `https://${forwardedHost}`
      : null
  const streamUrl = browserOrigin
    ? new URL(`/api/v1/automations/runs/events/ws?${query}`, browserOrigin.replace(/^https:/, 'wss:')).toString()
    : getOrchestratorBrowserWsUrl(`/automations/runs/events/ws?${query}`, { secure: isHttps })
  return { streamUrl }
}

export const cancelAutomationRun = async (runId: string) => {
  const user = await requireAutomationUser('automations:run', 'api')
  return orchestratorAutomationsClient.cancelRun(user.ownerUserId, runId)
}
