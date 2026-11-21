import type { ReactNode } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPlatformContainerLogsAction } from '@/server/orchestrator/platform/container-actions'
import { actionError, actionOk, type ActionResult } from '@/shared/actions/action-result'
import { RuntimeContainerDetail } from './runtime-container-detail'
import type { PlatformContainerDetails, PlatformContainerLog } from '@/shared/contracts/platform'
import type { ContainerResourceView } from '@/shared/model/container-resource-href'

const { details } = vi.hoisted(() => ({
  details: {
    container: {
      id: 'container-id',
      shortId: 'container',
      managed: true,
      orphaned: false,
      image: 'runtime:latest',
      imageId: 'image-id',
      command: 'boot',
      createdAt: '2026-01-01',
      state: 'exited',
      status: 'Exited',
      names: ['runtime'],
      applicationId: null,
      component: 'runtime',
      networks: ['private-network'],
      ports: [],
      labels: { component: 'runtime' }
    },
    inspect: { Name: 'runtime' },
    relatedImage: {
      id: 'image-id',
      shortId: 'image',
      repoTags: ['runtime:latest'],
      repoDigests: [],
      sizeBytes: 1024,
      sharedSizeBytes: 0,
      virtualSizeBytes: 1024,
      createdAt: '2026-01-01',
      labels: {},
      managed: true,
      containers: 1,
      runtimeMetadata: null,
      runtimeMetadataSource: null
    },
    relatedNetworks: [
      {
        id: 'network-id',
        shortId: 'network',
        name: 'private-network',
        driver: 'bridge',
        subnets: ['10.0.0.0/24'],
        scope: 'local',
        createdAt: null,
        internal: false,
        attachable: false,
        ingress: false,
        labels: {},
        managed: true,
        containers: ['container-id'],
        gateways: []
      }
    ]
  } satisfies PlatformContainerDetails
}))

vi.mock('./container-detail-context', () => ({
  ContainerDetailProvider: ({ children }: { children: ReactNode }) => children,
  useContainerDetailContext: () => ({ details }),
  useContainerDetailControllerContext: () => ({ setPendingAction: vi.fn() })
}))
vi.mock('./live-resources-section', () => ({ LiveResourcesSection: () => <div>Live resources</div> }))
vi.mock('@/server/orchestrator/platform/container-actions', () => ({
  getPlatformContainerLogsAction: vi.fn()
}))
vi.mock('./container-action-dialog', () => ({ ContainerActionDialog: () => null }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))

describe('container resource details', () => {
  beforeEach(() => {
    details.container.state = 'exited'
  })
  const page = (view: ContainerResourceView = 'overview') =>
    render(
      <RuntimeContainerDetail
        view={view}
        details={details}
      />
    )

  it('hides stopped-container metrics and links related resources with raw inspect already visible', () => {
    page()
    expect(screen.queryByText('Live resources')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Logs' })).toBeNull()
    expect(
      within(screen.getByRole('region', { name: 'Overview' })).queryByRole('button', { name: 'Remove' })
    ).toBeNull()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Stop' })).toBeDisabled()
    expect(screen.getByRole('link', { name: /runtime:latest/ })).toHaveAttribute('href', '/runtime/images/image-id')
    expect(screen.getByRole('link', { name: /private-network/ })).toHaveAttribute(
      'href',
      '/runtime/networks/network-id'
    )
    expect(screen.getByRole('region', { name: 'Raw inspect JSON' })).toHaveTextContent('runtime')
    expect(within(screen.getByRole('region', { name: 'Labels' })).getByText('runtime')).toBeVisible()
  })

  it('shows live metrics for running containers', () => {
    details.container.state = 'running'
    page()
    expect(screen.getByText('Live resources')).toBeVisible()
  })

  it('opens logs in a dedicated linked destination', () => {
    page('logs')
    expect(screen.getByRole('region', { name: 'Logs' })).toBeVisible()
    expect(screen.queryByRole('region', { name: 'Overview' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Logs' })).toHaveAttribute(
      'href',
      '/runtime/containers/container-id?view=logs'
    )
    expect(screen.getByRole('link', { name: 'Logs' })).toHaveAttribute('aria-current', 'page')
  })

  it('keeps the container header and last available log tail through a failed read and retry', async () => {
    const initial = Promise.withResolvers<ActionResult<PlatformContainerLog>>()
    const log: PlatformContainerLog = { source: 'container', collectedAt: '2026-01-01', output: 'Ready to serve' }
    vi.mocked(getPlatformContainerLogsAction)
      .mockResolvedValueOnce(actionOk(log))
      .mockResolvedValueOnce(actionError({ message: 'Docker unavailable', requestId: 'docker-ref' }))
    render(
      <RuntimeContainerDetail
        details={details}
        view='logs'
        pendingLogs={initial.promise}
      />
    )

    expect(screen.getByRole('heading', { name: 'runtime' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Logs' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled()
    initial.resolve(actionError({ message: 'Log tail too large', status: 413 }))
    expect(await screen.findByText('Container log tail exceeds the read limit')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(await screen.findByText('Ready to serve')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(await screen.findByText(/Showing the last collected log tail/)).toBeVisible()
    expect(screen.getByText('Ready to serve')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'runtime' })).toBeVisible()
  })

  it('opens the Terminal tab and prevents connection to an exited container', () => {
    page('terminal')
    expect(screen.getByRole('link', { name: 'Terminal' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Terminal' })).toHaveAttribute(
      'href',
      '/runtime/containers/container-id?view=terminal'
    )
    expect(screen.getByLabelText('Container user')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Connect' })).toBeDisabled()
    expect(screen.getByText('Container must be running to open a terminal.')).toBeVisible()
  })
})
