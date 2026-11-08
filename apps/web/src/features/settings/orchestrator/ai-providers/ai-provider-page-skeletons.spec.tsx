import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AiProvidersPageSkeleton } from './ai-provider-page-skeletons'

describe('AiProvidersPageSkeleton', () => {
  it('matches the current AI page structure', () => {
    render(<AiProvidersPageSkeleton />)

    expect(screen.getByTestId('ai-context-suggestions-skeleton')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Providers' })).toBeTruthy()
    expect(screen.getAllByTestId('data-grid-skeleton-row')).toHaveLength(5)
  })
})
