import { headers } from 'next/headers'
import 'server-only'
import { assertAutomationPermission } from '@/server/orchestrator/automations/action-helpers'
import { orchestratorAutomationsClient } from '@/server/orchestrator/automations/client'
import { getOrchestratorBrowserWsUrl } from '@/server/orchestrator/config'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'

export const readAutomationRunEvents = async (runId: string, after: number) => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:run')
  const [events, token] = await Promise.all([
    orchestratorAutomationsClient.listRunEvents(user.ownerUserId, runId, after),
    orchestratorAutomationsClient.createRunEventStreamToken(user.ownerUserId, runId)
  ])
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
    ? new URL(`/api/v1/automations/runs/events/ws?${query}`, browserOrigin)
    : new URL(getOrchestratorBrowserWsUrl(`/automations/runs/events/ws?${query}`, { secure: isHttps }))
  streamUrl.protocol = isHttps ? 'wss:' : 'ws:'
  return { events, streamUrl: streamUrl.toString() }
}

export const cancelAutomationRun = async (runId: string) => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:run')
  return orchestratorAutomationsClient.cancelRun(user.ownerUserId, runId)
}
