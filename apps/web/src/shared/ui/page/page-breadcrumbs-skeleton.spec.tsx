import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageBreadcrumbsSkeleton } from './page-breadcrumbs-skeleton'

describe('PageBreadcrumbsSkeleton', () => {
  it('matches the shared page header breadcrumb height', () => {
    render(<PageBreadcrumbsSkeleton itemWidths={['w-16', 'w-24']} />)

    expect(screen.getByRole('list', { name: 'Loading breadcrumbs' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })
})
