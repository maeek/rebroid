import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { pullPlatformImageAction, removePlatformImageAction } from '@/server/orchestrator/platform/image-actions'
import { removePlatformNetworkAction } from '@/server/orchestrator/platform/network-actions'
import { actionError, actionOk } from '@/shared/actions/action-result'
import { RuntimeImageDetail } from './runtime-image-detail'
import { RuntimeNetworkDetail } from './runtime-network-detail'
import type { PlatformImageDetails, PlatformNetworkDetails } from '@/shared/contracts/platform'

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace }) }))
vi.mock('@/server/orchestrator/platform/image-actions', () => ({
  pullPlatformImageAction: vi.fn(),
  removePlatformImageAction: vi.fn()
}))
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
    expect(screen.getByRole('dialog', { name: 'Remove “runtime:latest”?' })).toBeVisible()
    expect(removePlatformImageAction).not.toHaveBeenCalled()
  })

  it('reports pending and failed pulls and follows the tag after a confirmed retry', async () => {
    const reference = 'registry.example:5000/team/runtime:v1'
    const pull = Promise.withResolvers<Awaited<ReturnType<typeof pullPlatformImageAction>>>()
    vi.mocked(pullPlatformImageAction)
      .mockReturnValueOnce(pull.promise)
      .mockResolvedValueOnce(actionOk({ image: reference, status: 'pulled' }))
    render(
      <RuntimeImageDetail details={{ ...imageDetails, image: { ...imageDetails.image, repoTags: [reference] } }} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Pull again' }))
    expect(pullPlatformImageAction).toHaveBeenCalledWith('from-reference', reference)
    const pending = screen.getByRole('button', { name: 'Pulling image…' })
    expect(pending).toHaveAttribute('aria-busy', 'true')
    expect(pending).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled()
    expect(replace).not.toHaveBeenCalled()

    pull.resolve(actionError({ message: 'The registry rejected the pull.', requestId: 'pull-request' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Request ID pull-request')
    expect(replace).not.toHaveBeenCalled()

    fireEvent.click(await screen.findByRole('button', { name: 'Pull again' }))
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/runtime/images/${encodeURIComponent(reference)}`))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('disables pulling a local image without a registry reference', () => {
    render(<RuntimeImageDetail details={{ ...imageDetails, image: { ...imageDetails.image, repoTags: [] } }} />)

    expect(screen.getByRole('button', { name: 'Pull again' })).toBeDisabled()
    expect(screen.getByText('This image has no registry tag or digest.')).toBeVisible()
  })

  it('places network removal in its header and keeps the confirmation step', () => {
    render(<RuntimeNetworkDetail details={networkDetails} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Private network')
    expect(
      within(screen.getByRole('region', { name: 'Overview' })).queryByRole('button', { name: 'Remove' })
    ).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.getByRole('dialog', { name: 'Remove “Private network”?' })).toBeVisible()
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
