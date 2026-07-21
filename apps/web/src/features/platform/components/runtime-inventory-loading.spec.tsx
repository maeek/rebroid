import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FeatureFlagsProvider } from '@/shared/model/features/feature-flags-context'
import { RuntimeContainersPageLoading } from './runtime-containers-page-client'
import { RuntimeImagesPageLoading } from './runtime-images-page-client'
import { RuntimeNetworksPageLoading } from './runtime-networks-page-client'

const expectLoadingGrid = (expectedWidth: string, headings: string[]) => {
  const table = screen.getByRole('table')
  expect(table.style.width).toBe(expectedWidth)
  expect(table.style.minWidth).toBe('100%')
  expect(screen.getAllByTestId('data-grid-skeleton-row')).toHaveLength(20)
  for (const heading of headings) {
    expect(screen.getByRole('columnheader', { name: heading })).toBeTruthy()
  }
}

describe('runtime inventory loading geometry', () => {
  it('uses the real image columns without a duplicate actions column', () => {
    render(
      <FeatureFlagsProvider manifest={null}>
        <RuntimeImagesPageLoading />
      </FeatureFlagsProvider>
    )

    expectLoadingGrid('1120px', ['Image', 'Size', 'Created', 'Containers', 'ID'])
    expect(screen.getAllByRole('columnheader')).toHaveLength(8)
  })

  it('uses the real container columns without a duplicate actions column', () => {
    render(<RuntimeContainersPageLoading />)

    expectLoadingGrid('1440px', ['Container', 'State', 'Image', 'Application', 'Networks'])
    expect(screen.getAllByRole('columnheader')).toHaveLength(8)
  })

  it('uses the real network columns and derived width', () => {
    render(<RuntimeNetworksPageLoading />)

    expectLoadingGrid('1328px', ['Network', 'Driver', 'Scope', 'Subnet', 'Gateway', 'Containers'])
    expect(screen.getAllByRole('columnheader')).toHaveLength(9)
  })
})
