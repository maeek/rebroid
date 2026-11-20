'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { getOrchestratorHealthSummaryAction } from '@/server/orchestrator/diagnostics/actions'
import {
  dockerRuntimeHealth,
  serviceHealthState,
  type DisplayServiceHealth
} from '@/shared/model/diagnostics/service-health'
import type { OrchestratorHealth } from '@/shared/contracts/diagnostics'

export type NavigationHealthId = 'system' | 'display' | 'firewall' | 'docker' | 'ocr'
type ServiceState = ReturnType<typeof serviceHealthState>
export type NavigationHealthStatus =
  Exclude<ServiceState, { label: 'Healthy' }> | { label: 'Checking'; tone: 'neutral'; description: string }

const checking = { label: 'Checking', tone: 'neutral', description: 'Waiting for the first health check.' } as const

const getSystemStatus = (health?: OrchestratorHealth, error?: unknown): NavigationHealthStatus | undefined => {
  if (error)
    return { label: 'Offline', tone: 'danger', description: 'The platform health summary could not be retrieved.' }
  if (!health) return checking
  if (!health.services.orchestrator.ok) {
    return { label: 'Offline', tone: 'danger', description: health.services.orchestrator.message }
  }
  if (health.ok) return undefined
  const reasons = Object.values(health.services)
    .filter(service => !service.ok && service.status !== 'disabled')
    .map(service => service.message.trim())
    .filter(Boolean)
  return {
    label: 'Degraded',
    tone: 'warning',
    description: [...new Set(reasons)].join(' ') || 'One or more platform health checks failed.'
  }
}

const PlatformHealthContext = createContext<Partial<Record<NavigationHealthId, NavigationHealthStatus>>>({})

export const PlatformHealthProvider = ({ polling, children }: { polling: boolean; children: ReactNode }) => {
  const { data, error } = usePollingQuery<OrchestratorHealth>(
    'orchestrator:health',
    () => getOrchestratorHealthSummaryAction(),
    { enabled: polling, intervalMs: 10_000 }
  )
  const health = error ? undefined : data
  const serviceIssue = (service?: DisplayServiceHealth) => {
    if (!health && !error) return checking
    const state = serviceHealthState(service)
    return state.label === 'Healthy' ? undefined : state
  }
  const statuses = {
    system: getSystemStatus(health, error),
    display: serviceIssue(health?.services.display),
    firewall: serviceIssue(health?.services.firewall),
    docker: serviceIssue(health && dockerRuntimeHealth(health)),
    ocr: serviceIssue(health?.services.ocr)
  }

  return <PlatformHealthContext.Provider value={statuses}>{children}</PlatformHealthContext.Provider>
}

export const usePlatformHealth = () => useContext(PlatformHealthContext)
