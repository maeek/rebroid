import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ServiceHealthNotice } from '@/shared/ui/platform/service-health-notice'

describe('ServiceHealthNotice', () => {
  it.each([
    ['healthy', 'Healthy', 'success', 'status'],
    ['offline', 'Offline', 'danger', 'alert'],
    ['disabled', 'Disabled', 'info', 'status']
  ] as const)('renders %s health in the shared notice', (status, label, tone, role) => {
    render(<ServiceHealthNotice health={{ status, ok: status === 'healthy', message: 'Firewall agent health.' }} />)

    const notice = screen.getByRole(role)
    expect(notice).toHaveClass('w-full')
    expect(notice).toHaveAttribute('data-level', 'band')
    expect(notice).toHaveAttribute('data-tone', tone)
    expect(notice).toHaveTextContent(label)
    expect(notice).toHaveTextContent('Firewall agent health.')
  })
})
