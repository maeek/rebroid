import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RelatedContainersGrid } from './related-containers-grid'
import type { PlatformContainer } from '@/shared/contracts/platform'

const container: PlatformContainer = {
  id: 'container-id',
  shortId: 'container',
  names: ['Worker'],
  image: 'runtime:latest',
  imageId: 'sha256:image',
  state: 'running',
  status: 'Up',
  managed: true,
  orphaned: false,
  applicationId: 'app-id',
  applicationName: 'Inventory worker',
  component: 'runtime',
  networks: [],
  ports: [],
  labels: {},
  command: 'boot',
  createdAt: '2026-01-01'
}

describe('related container references', () => {
  it('links the container and its image to their resource pages', () => {
    render(
      <RelatedContainersGrid
        containers={[container]}
        relation='image'
      />
    )
    expect(screen.getByRole('link', { name: 'Worker' })).toHaveAttribute('href', '/runtime/containers/container-id')
    expect(screen.getByRole('link', { name: 'runtime:latest' })).toHaveAttribute(
      'href',
      '/runtime/images/sha256%3Aimage'
    )
  })

  it('links known applications and leaves unmanaged references as plain text', () => {
    render(
      <RelatedContainersGrid
        containers={[container, { ...container, id: 'other', names: ['Unmanaged worker'], applicationId: null }]}
        relation='application'
      />
    )
    expect(screen.getByRole('link', { name: 'Inventory worker' })).toHaveAttribute('href', '/app/app-id')
    expect(screen.getByText('Unmanaged', { exact: true })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Unmanaged' })).toBeNull()
  })
})
