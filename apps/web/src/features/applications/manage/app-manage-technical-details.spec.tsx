import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { previewApp } from '@/features/applications/detail/app-resource-preview-data'
import { AppManageTechnicalDetails } from './app-manage-technical-details'

const app = {
  ...previewApp,
  containerId: 'container-id',
  containerName: 'worker',
  containerImage: 'registry/runtime:latest',
  networkName: 'worker-network'
}

describe('app diagnostic resource references', () => {
  it('links infrastructure resources only when administrator access is provided', () => {
    render(
      <AppManageTechnicalDetails
        app={app}
        canViewInfrastructure
      />
    )
    expect(screen.getByRole('link', { name: 'worker-network' })).toHaveAttribute(
      'href',
      '/runtime/networks/worker-network'
    )
    expect(screen.getByRole('link', { name: 'registry/runtime:latest' })).toHaveAttribute(
      'href',
      '/runtime/images/registry%2Fruntime%3Alatest'
    )
    expect(screen.getByRole('link', { name: 'worker' })).toHaveAttribute('href', '/runtime/containers/container-id')
    expect(screen.getByRole('button', { name: 'Copy Network' })).toBeInTheDocument()
  })

  it('keeps backend details readable and copyable without infrastructure access', () => {
    render(<AppManageTechnicalDetails app={app} />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('worker-network', { exact: true })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Copy Network' })).toBeInTheDocument()
  })

  it('does not link a container that has not been created', () => {
    render(
      <AppManageTechnicalDetails
        app={{ ...app, containerId: null }}
        canViewInfrastructure
      />
    )
    expect(screen.queryByRole('link', { name: 'worker' })).toBeNull()
    expect(screen.getByText('Not created')).toBeVisible()
  })

  it('shows the inspected command for the current container instead of its saved arguments', () => {
    const savedApp = { ...app, containerArgs: 'androidboot.redroid_gpu_mode=guest' }
    const command = '/init androidboot.redroid_gpu_mode=host'
    const inspectedCommand = { containerId: app.containerId, command }
    const { rerender } = render(
      <AppManageTechnicalDetails
        app={savedApp}
        canViewInfrastructure
        inspectedCommand={inspectedCommand}
      />
    )
    expect(screen.getByText(command)).toBeVisible()
    expect(screen.queryByText(savedApp.containerArgs)).not.toBeInTheDocument()

    rerender(
      <AppManageTechnicalDetails
        app={{ ...savedApp, containerId: 'replacement' }}
        canViewInfrastructure
        inspectedCommand={inspectedCommand}
      />
    )
    expect(screen.queryByText(command)).not.toBeInTheDocument()
    expect(screen.getByText('Unavailable')).toBeVisible()
  })
})
