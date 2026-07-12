import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PlatformStatusBanner } from '@/shared/ui/platform/platform-status-banner'

describe('PlatformStatusBanner', () => {
  it('uses the full-width shared status surface', () => {
    render(
      <PlatformStatusBanner
        status='healthy'
        ok
        message='Firewall agent is ready.'
      />
    )

    const banner = screen.getByRole('status')
    expect(banner).toHaveClass('w-full')
    expect(banner).toHaveAttribute('data-level', 'band')
    expect(banner).toHaveAttribute('data-tone', 'success')
  })
})
