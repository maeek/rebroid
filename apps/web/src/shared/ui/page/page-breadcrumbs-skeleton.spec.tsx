import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageBreadcrumbsSkeleton } from './page-breadcrumbs-skeleton'

describe('PageBreadcrumbsSkeleton', () => {
  it('matches the shared page header breadcrumb height', () => {
    const { container } = render(<PageBreadcrumbsSkeleton itemWidths={['w-16', 'w-24']} />)
    const items = Array.from(container.querySelectorAll('.h-5'))

    expect(items).toHaveLength(2)
  })
})
