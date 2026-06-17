import { describe, expect, it } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { AiProvidersPageSkeleton } from './ai-provider-page-skeletons'

describe('AiProvidersPageSkeleton', () => {
  it('matches the current AI page structure', () => {
    render(<AiProvidersPageSkeleton />)

    expect(screen.getByTestId('ai-context-suggestions-skeleton')).toBeTruthy()
    expect(screen.getByTestId('ai-providers-heading-skeleton')).toBeTruthy()
    expect(screen.getByTestId('data-grid-skeleton')).toBeTruthy()
  })
})
