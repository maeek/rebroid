import { fireEvent, render, screen } from '@testing-library/react'
import { unstable_rethrow } from 'next/navigation'
import { describe, expect, it, vi } from 'vitest'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { RuntimeDetailUnavailable } from './runtime-detail-unavailable'

const refresh = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
  unstable_rethrow: vi.fn()
}))

const props = { resource: 'Container', href: '/runtime/containers', backLabel: 'Back to containers' }

describe('runtime detail failures', () => {
  it('offers retry for an outage without exposing internal error text', () => {
    render(
      <RuntimeDetailUnavailable
        {...props}
        error={new OrchestratorRequestError('private host detail', 503, 'ref-123')}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Container details unavailable')
    expect(screen.getByText('Reference: ref-123')).toBeVisible()
    expect(screen.queryByText('private host detail')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('provides a return link for a removed resource without retrying it', () => {
    render(
      <RuntimeDetailUnavailable
        {...props}
        error={new OrchestratorRequestError('missing', 404)}
      />
    )
    expect(screen.getByRole('heading', { name: 'Container not found' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Back to containers' })).toHaveAttribute('href', '/runtime/containers')
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('preserves framework redirects instead of converting them into feedback', () => {
    const redirect = new Error('redirect')
    vi.mocked(unstable_rethrow).mockImplementationOnce(() => {
      throw redirect
    })
    expect(() => RuntimeDetailUnavailable({ ...props, error: redirect })).toThrow(redirect)
  })
})
