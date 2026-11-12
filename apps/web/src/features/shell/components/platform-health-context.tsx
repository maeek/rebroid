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
export type NavigationHealthStatus = { label: string; dot: string }

const dotByTone = {
  neutral: 'bg-foreground-muted/60',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger'
}
const checking = { label: 'Checking', dot: dotByTone.neutral }

const getServiceStatus = (health?: DisplayServiceHealth): NavigationHealthStatus => {
  const { label, tone } = serviceHealthState(health)
  return { label, dot: dotByTone[tone] }
}

const getSystemStatus = (health?: OrchestratorHealth, error?: unknown): NavigationHealthStatus => {
  if (error || health?.services.orchestrator.ok === false) return { label: 'System offline', dot: dotByTone.danger }
  if (!health) return checking
  if (health.ok) return { label: 'System healthy', dot: dotByTone.success }
  return { label: 'System degraded', dot: dotByTone.warning }
}

const PlatformHealthContext = createContext<Partial<Record<NavigationHealthId, NavigationHealthStatus>>>({})

export const PlatformHealthProvider = ({ polling, children }: { polling: boolean; children: ReactNode }) => {
  const { data, error } = usePollingQuery<OrchestratorHealth>(
    'orchestrator:health',
    () => getOrchestratorHealthSummaryAction(),
    { enabled: polling, intervalMs: 10_000 }
  )
  const health = error ? undefined : data
  const fallback = error ? getServiceStatus() : checking
  const statuses = {
    system: getSystemStatus(health, error),
    display: health ? getServiceStatus(health.services.display) : fallback,
    firewall: health ? getServiceStatus(health.services.firewall) : fallback,
    docker: health ? getServiceStatus(dockerRuntimeHealth(health)) : fallback,
    ocr: health ? getServiceStatus(health.services.ocr) : fallback
  }

  return <PlatformHealthContext.Provider value={statuses}>{children}</PlatformHealthContext.Provider>
}

export const usePlatformHealth = () => useContext(PlatformHealthContext)
