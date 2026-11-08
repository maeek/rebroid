import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { removePlatformImageAction } from '@/server/orchestrator/platform/image-actions'
import { removePlatformNetworkAction } from '@/server/orchestrator/platform/network-actions'
import { RuntimeImageDetail } from './runtime-image-detail'
import { RuntimeNetworkDetail } from './runtime-network-detail'
import type { PlatformImageDetails, PlatformNetworkDetails } from '@/shared/contracts/platform'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/server/orchestrator/platform/image-actions', () => ({ removePlatformImageAction: vi.fn() }))
vi.mock('@/server/orchestrator/platform/network-actions', () => ({ removePlatformNetworkAction: vi.fn() }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))

const imageDetails: PlatformImageDetails = {
  image: {
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
    containers: 0,
    runtimeMetadata: null,
    runtimeMetadataSource: null
  },
  relatedContainers: [],
  inspect: {}
}
const networkDetails: PlatformNetworkDetails = {
  network: {
    id: 'network-id',
    shortId: 'network',
    name: 'Private network',
    driver: 'bridge',
    scope: 'local',
    subnets: [],
    gateways: [],
    createdAt: null,
    internal: false,
    attachable: false,
    ingress: false,
    labels: {},
    managed: true,
    containers: []
  },
  relatedContainers: [],
  inspect: {}
}

describe('runtime resource header actions', () => {
  it('places image removal beside its heading and opens confirmation before mutating', () => {
    render(<RuntimeImageDetail details={imageDetails} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('runtime:latest')
    expect(
      within(screen.getByRole('region', { name: 'Overview' })).queryByRole('button', { name: 'Remove' })
    ).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Remove image?')
    expect(removePlatformImageAction).not.toHaveBeenCalled()
  })

  it('places network removal in its header and keeps the confirmation step', () => {
    render(<RuntimeNetworkDetail details={networkDetails} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Private network')
    expect(
      within(screen.getByRole('region', { name: 'Overview' })).queryByRole('button', { name: 'Remove' })
    ).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Remove network?')
    expect(removePlatformNetworkAction).not.toHaveBeenCalled()
  })

  it('keeps network removal disabled while containers are attached', () => {
    render(
      <RuntimeNetworkDetail
        details={{ ...networkDetails, network: { ...networkDetails.network, containers: ['container-id'] } }}
      />
    )
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled()
  })
})
