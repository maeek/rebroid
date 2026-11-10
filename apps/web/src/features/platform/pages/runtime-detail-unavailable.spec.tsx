import { fireEvent, render, screen } from '@testing-library/react'
import { unstable_rethrow } from 'next/navigation'
import { describe, expect, it, vi } from 'vitest'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { loadRuntimeContainerDetailPageData } from './runtime-container-detail/page-data.server'
import { RuntimeContainerDetailPageEntry } from './runtime-container-detail/page-entry'

const refresh = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
  unstable_rethrow: vi.fn()
}))

vi.mock('./runtime-container-detail/page-data.server', () => ({
  loadRuntimeContainerDetailPageData: vi.fn()
}))

const loadPage = () =>
  RuntimeContainerDetailPageEntry({
    params: Promise.resolve({ id: 'app' }),
    searchParams: Promise.resolve({ view: 'logs' })
  })

describe('runtime detail failures', () => {
  it('offers retry for an outage without exposing internal error text', async () => {
    vi.mocked(loadRuntimeContainerDetailPageData).mockRejectedValueOnce(
      new OrchestratorRequestError('private host detail', 503, 'ref-123')
    )
    render(await loadPage())
    expect(loadRuntimeContainerDetailPageData).toHaveBeenLastCalledWith('app', 'logs')
    expect(screen.getByRole('alert')).toHaveTextContent('Container details unavailable')
    expect(screen.getByText('Reference: ref-123')).toBeVisible()
    expect(screen.queryByText('private host detail')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('provides a return link for a removed resource without retrying it', async () => {
    vi.mocked(loadRuntimeContainerDetailPageData).mockRejectedValueOnce(new OrchestratorRequestError('missing', 404))
    render(await loadPage())
    expect(screen.getByRole('heading', { name: 'Container not found' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Back to containers' })).toHaveAttribute('href', '/runtime/containers')
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('preserves framework redirects instead of converting them into feedback', async () => {
    const redirect = new Error('redirect')
    vi.mocked(unstable_rethrow).mockImplementationOnce(() => {
      throw redirect
    })
    vi.mocked(loadRuntimeContainerDetailPageData).mockRejectedValueOnce(redirect)
    await expect(loadPage()).rejects.toBe(redirect)
  })
})
