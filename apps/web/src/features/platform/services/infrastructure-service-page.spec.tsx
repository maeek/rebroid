import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { serviceHealthState } from '@/shared/model/diagnostics/service-health'
import { InfrastructureServicePage } from './infrastructure-service-page'
import { servicesPreviewHealth } from './services-preview'

const { refresh, limits, metrics } = vi.hoisted(() => ({ refresh: vi.fn(), limits: vi.fn(), metrics: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('./docker-operation-limits-section', () => ({
  DockerOperationLimitsSection: () => {
    limits()
    return <div>Limits loaded</div>
  }
}))
vi.mock('@/features/platform/metrics/docker-metrics-dashboard', () => ({
  DockerMetricsDashboard: () => {
    metrics()
    return <div>Metrics loaded</div>
  }
}))

describe('infrastructure service availability', () => {
  it('links from the orchestrator connection to its container Logs tab', () => {
    render(
      <InfrastructureServicePage
        serviceId='orchestrator'
        initialHealth={servicesPreviewHealth}
        apiUrl='http://orchestrator:4100'
        containerId='orchestrator-id'
      />
    )
    expect(screen.getByRole('status')).toHaveTextContent('Healthy')
    expect(screen.queryByText('Orchestrator API is responding.')).toBeNull()
    const connection = screen.getByRole('region', { name: 'Connection' })
    expect(within(connection).getByRole('link', { name: 'View logs' })).toHaveAttribute(
      'href',
      '/runtime/containers/orchestrator-id?view=logs'
    )
  })

  it('shows one warning without mounting dependent requests and recovers after refresh', () => {
    const { rerender } = render(
      <InfrastructureServicePage
        serviceId='docker'
        initialHealth={null}
        apiUrl=''
      />
    )
    expect(screen.getByRole('navigation', { name: 'breadcrumb' })).toHaveTextContent('DockerOverview')
    expect(screen.getByRole('status')).toHaveAttribute('data-tone', 'warning')
    expect(screen.getByRole('status')).toHaveTextContent('Unknown')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Infrastructure diagnostics' })).toBeNull()
    expect(limits).not.toHaveBeenCalled()
    expect(metrics).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(refresh).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled()
    rerender(
      <InfrastructureServicePage
        serviceId='docker'
        initialHealth={servicesPreviewHealth}
        apiUrl=''
      />
    )
    expect(screen.getByText('Limits loaded')).toBeVisible()
    expect(screen.getByText('Metrics loaded')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Healthy')
    expect(screen.queryByText('Unknown')).toBeNull()
  })

  it('suppresses downstream requests when the orchestrator is explicitly offline', () => {
    render(
      <InfrastructureServicePage
        serviceId='docker'
        apiUrl=''
        initialHealth={{
          ...servicesPreviewHealth,
          services: {
            ...servicesPreviewHealth.services,
            orchestrator: { ok: false, status: 'offline', message: 'Offline' }
          }
        }}
      />
    )
    expect(limits).not.toHaveBeenCalled()
    expect(metrics).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('orchestrator could not be reached')
  })

  it('keeps orchestrator-owned diagnostics available when only Docker is offline', () => {
    render(
      <InfrastructureServicePage
        serviceId='docker'
        apiUrl=''
        initialHealth={{
          ...servicesPreviewHealth,
          services: {
            ...servicesPreviewHealth.services,
            docker: { ok: false, status: 'offline', message: 'Docker is offline.' }
          }
        }}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Docker is offline.')
    expect(screen.getByText('Limits loaded')).toBeVisible()
    expect(screen.getByText('Metrics loaded')).toBeVisible()
  })

  it('uses warning for unknown health while disabled services remain neutral', () => {
    expect(serviceHealthState().tone).toBe('warning')
    expect(serviceHealthState({ ok: false, status: 'disabled', message: 'Disabled' }).tone).toBe('neutral')
  })
})
