import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProviderModelAddDialog } from './provider-model-download'

const props = () => ({
  open: true,
  isSubmitting: false,
  isLoadingRemoteModels: false,
  providerKind: 'ollama',
  remoteModels: [
    { id: 'Exact/Model:Q4', label: 'Screen model' },
    { id: 'configured', label: 'Already configured' }
  ],
  configuredModelIds: ['configured'],
  remoteModelsError: null,
  onLoadRemoteModels: vi.fn(),
  onOpenChange: vi.fn(),
  onAddExisting: vi.fn().mockResolvedValue(true),
  onDownload: vi.fn().mockResolvedValue(undefined)
})
const chooseSource = async (name: string) => {
  fireEvent.click(screen.getByRole('combobox', { name: 'Model source' }))
  const option = await screen.findByRole('option', { name })
  fireEvent.pointerDown(option, { pointerType: 'mouse' })
  fireEvent.click(option)
}

describe('add provider model', () => {
  it('searches available models, excludes configured IDs, and adds the selected exact ID', async () => {
    const callbacks = props()
    render(<ProviderModelAddDialog {...callbacks} />)
    const search = screen.getByRole('combobox', { name: 'Available model' })
    expect(search).toHaveAttribute('id', 'provider-model-available')
    expect(search).toHaveAttribute('aria-describedby', 'provider-model-available-description')
    fireEvent.focus(search)
    fireEvent.click(search)
    fireEvent.change(search, { target: { value: 'Screen' } })
    expect(screen.queryByRole('option', { name: /Already configured/ })).toBeNull()
    fireEvent.click(await screen.findByRole('option', { name: /Screen model/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add model' }))
    await waitFor(() =>
      expect(callbacks.onAddExisting).toHaveBeenCalledWith('Exact/Model:Q4', 'Screen model', ['controller', 'planner'])
    )
    expect(callbacks.onDownload).not.toHaveBeenCalled()
    expect(callbacks.onOpenChange).toHaveBeenCalledWith(false)
  })

  it('allows manual registration with Ollama without starting a download and retains failed drafts', async () => {
    const callbacks = props()
    callbacks.onAddExisting.mockResolvedValue(false)
    render(<ProviderModelAddDialog {...callbacks} />)
    await chooseSource('Enter model ID')
    fireEvent.change(screen.getByLabelText('Model ID'), { target: { value: 'custom:tag' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add model' }))
    await waitFor(() => expect(callbacks.onAddExisting).toHaveBeenCalled())
    expect(callbacks.onDownload).not.toHaveBeenCalled()
    expect(callbacks.onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Model ID')).toHaveValue('custom:tag')
  })

  it('starts a separate download and prevents closing while the request is pending', async () => {
    const callbacks = props()
    let complete: () => void = () => undefined
    callbacks.onDownload.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          complete = resolve
        })
    )
    render(<ProviderModelAddDialog {...callbacks} />)
    await chooseSource('Download with Ollama')
    fireEvent.change(screen.getByLabelText('Model ID'), { target: { value: 'model:tag' } })
    fireEvent.click(screen.getByRole('button', { name: 'Download and add' }))
    expect(screen.getByRole('button', { name: 'Starting download…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(callbacks.onDownload).toHaveBeenCalledWith('model:tag', '')
    complete()
    await waitFor(() => expect(callbacks.onOpenChange).toHaveBeenCalledWith(false))
    expect(callbacks.onAddExisting).not.toHaveBeenCalled()
  })

  it('shows catalog errors on the searchable control without blocking manual registration', async () => {
    render(
      <ProviderModelAddDialog
        {...props()}
        remoteModelsError='Provider could not be reached.'
      />
    )
    expect(screen.getByRole('combobox', { name: 'Available model' })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Provider could not be reached.')
    await chooseSource('Enter model ID')
    fireEvent.change(screen.getByLabelText('Model ID'), { target: { value: 'configured' } })
    expect(screen.getByLabelText('Model ID')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('button', { name: 'Add model' })).toBeDisabled()
  })
})
