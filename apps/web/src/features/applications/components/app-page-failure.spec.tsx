import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppPageFailure } from './app-page-failure'

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

describe('App page recovery', () => {
  it('explains invalid links and leads back to the app list', () => {
    render(<AppPageFailure failure={{ kind: 'invalid-link' }} />)
    expect(screen.getByRole('heading', { name: 'Invalid app link', level: 1 })).toBeVisible()
    expect(screen.getByRole('link', { name: 'View all apps' })).toHaveAttribute('href', '/apps')
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })

  it('offers a retry and a shareable reference for an unavailable app page', () => {
    render(<AppPageFailure failure={{ kind: 'unavailable', requestId: 'app-request-1' }} />)
    expect(screen.getByRole('heading', { name: 'Could not load app', level: 1 })).toBeVisible()
    expect(screen.getByText(/app-request-1/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refresh).toHaveBeenCalledOnce()
  })
})
