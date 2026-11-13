import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from '@/hooks/use-toast'
import { ActionResultError } from '@/shared/actions/action-result'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import {
  resetOrchestratorUiSettings,
  saveOrchestratorUiSettings
} from '@/shared/model/settings/use-orchestrator-ui-settings'
import { PlatformRuntimePageClient } from './pages/platform-runtime/page-client'
import { PlatformRuntimeForm } from './platform-runtime-form'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
vi.mock('@/shared/model/settings/use-orchestrator-ui-settings', () => ({
  saveOrchestratorUiSettings: vi.fn(),
  resetOrchestratorUiSettings: vi.fn()
}))
vi.mock('@/server/orchestrator/docker-maintenance/actions', () => ({
  pruneAllDockerResourcesAction: vi.fn(),
  pruneContainersAction: vi.fn(),
  pruneImagesAction: vi.fn(),
  pruneNetworksAction: vi.fn(),
  pruneVolumesAction: vi.fn()
}))
vi.mock('@/server/orchestrator/settings/actions', () => ({ cleanupUploadedApksAction: vi.fn() }))

const initialSettings = { ...defaultOrchestratorUiSettings, removeDataOnDelete: false }
const renderForm = () =>
  render(
    <PlatformRuntimeForm
      images={[]}
      initialSettings={initialSettings}
      appliedRenderingSettings={[{ mode: 'host', renderDevice: '/dev/dri/renderD128' }, null]}
    />
  )
beforeEach(() => {
  vi.clearAllMocks()
})

describe('Runtime defaults workflow', () => {
  it('retains an existing draft through an outage and resumes editing after recovery', () => {
    const data = { images: [], initialSettings, appliedRenderingSettings: [] }
    const { rerender } = render(<PlatformRuntimePageClient data={data} />)
    const registry = screen.getByLabelText('Image registry')
    fireEvent.change(registry, { target: { value: 'registry.example' } })
    rerender(<PlatformRuntimePageClient data={null} />)
    expect(registry).toHaveValue('registry.example')
    expect(registry).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByText('Runtime defaults could not be refreshed')).toBeVisible()
    rerender(
      <PlatformRuntimePageClient data={{ ...data, initialSettings: { ...initialSettings, maxApkUploadSizeMb: 128 } }} />
    )
    expect(registry).toHaveValue('registry.example')
    expect(registry).toBeEnabled()
    expect(screen.getByLabelText('Max APK size')).toHaveValue(128)
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('shows rendering settings in the defaults form and lets users discard local changes', async () => {
    renderForm()
    const registry = await screen.findByLabelText('Image registry')
    const form = screen.getByRole('form', { name: 'Runtime defaults' })
    const hardware = within(form).getByRole('region', { name: 'Hardware Acceleration' })
    expect(within(hardware).getByRole('combobox', { name: 'Rendering mode' })).toHaveTextContent('Software (default)')
    expect(screen.queryByRole('region', { name: 'Connection' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.change(registry, { target: { value: 'registry.example:5000' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(registry).toHaveValue('')
    expect(saveOrchestratorUiSettings).not.toHaveBeenCalled()
    expect(resetOrchestratorUiSettings).not.toHaveBeenCalled()
  })

  it('saves runtime defaults without resending hidden service settings', async () => {
    vi.mocked(saveOrchestratorUiSettings).mockResolvedValue({ ...initialSettings, maxApkUploadSizeMb: 256 })
    renderForm()
    const limit = await screen.findByLabelText('Max APK size')
    fireEvent.change(limit, { target: { value: '256' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Runtime defaults' }))
    await waitFor(() => expect(saveOrchestratorUiSettings).toHaveBeenCalledWith({ maxApkUploadSizeMb: 256 }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Saved' })).toBeDisabled())
    expect(limit).toHaveValue(256)
    fireEvent.change(limit, { target: { value: '300' } })
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(limit).toHaveValue(256)
  })

  it.each(['click', 'Enter'] as const)('saves a manually entered default image selected with %s', async selection => {
    const defaultContainerImage = 'registry.example:5000/android/redroid:14'
    vi.mocked(saveOrchestratorUiSettings).mockResolvedValue({ ...initialSettings, defaultContainerImage })
    renderForm()

    const image = screen.getByRole('combobox', { name: 'Default image' })
    fireEvent.click(image)
    fireEvent.input(image, { target: { value: defaultContainerImage }, inputType: 'insertText' })
    const option = await screen.findByRole('option', { name: /Use this image reference/ })
    expect(option).toHaveTextContent(defaultContainerImage)
    if (selection === 'click') fireEvent.click(option)
    else fireEvent.keyDown(image, { key: 'Enter' })

    expect(image).toHaveValue(defaultContainerImage)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(saveOrchestratorUiSettings).toHaveBeenCalledExactlyOnceWith({ defaultContainerImage }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Saved' })).toBeDisabled())
  })

  it('validates the GPU device and saves rendering and app defaults in one request', async () => {
    const androidRendering = { mode: 'host', renderDevice: '/dev/dri/renderD128' } as const
    vi.mocked(saveOrchestratorUiSettings)
      .mockRejectedValueOnce(
        new ActionResultError({
          message: 'Settings unavailable',
          code: 'upstream_unavailable',
          requestId: 'gpu-save-1'
        })
      )
      .mockResolvedValueOnce({ ...initialSettings, androidRendering, maxApkUploadSizeMb: 256 })
    renderForm()
    const mode = screen.getByRole('combobox', { name: 'Rendering mode' })
    const save = screen.getByRole('button', { name: 'Save' })
    expect(screen.queryByRole('textbox', { name: /GPU render device/ })).toBeNull()
    expect(screen.getByText(/1 differ from the saved setting and 1 have no recorded configuration/)).toBeVisible()

    fireEvent.click(mode)
    const host = await screen.findByRole('option', { name: 'Host GPU' })
    fireEvent.pointerDown(host, { pointerType: 'mouse' })
    fireEvent.click(host)
    const device = await screen.findByRole('textbox', { name: /GPU render device/ })
    expect(save).toBeDisabled()
    fireEvent.change(device, { target: { value: '/dev/sda' } })
    expect(device).toHaveAttribute('aria-invalid', 'true')
    expect(save).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Discard changes' })).toBeEnabled()
    fireEvent.submit(screen.getByRole('form', { name: 'Runtime defaults' }))
    expect(saveOrchestratorUiSettings).not.toHaveBeenCalled()

    fireEvent.change(device, { target: { value: androidRendering.renderDevice } })
    const limit = screen.getByRole('spinbutton', { name: 'Max APK size' })
    fireEvent.change(limit, { target: { value: '256' } })
    fireEvent.click(save)
    const dialog = await screen.findByRole('dialog', { name: 'Save Android rendering changes?' })
    expect(within(dialog).getByText(/Stop and start affected Redroid apps/)).toBeVisible()
    expect(within(dialog).getByText(/Restart sidecar/)).toBeVisible()
    expect(saveOrchestratorUiSettings).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(device).toHaveValue(androidRendering.renderDevice)
    expect(saveOrchestratorUiSettings).not.toHaveBeenCalled()
    fireEvent.click(save)
    const confirm = await screen.findByRole('button', { name: 'Save changes' })
    fireEvent.click(confirm)
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'danger' })))
    expect(device).toHaveValue(androidRendering.renderDevice)
    expect(limit).toHaveValue(256)
    fireEvent.click(confirm)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(save).toBeDisabled()
    expect(saveOrchestratorUiSettings).toHaveBeenNthCalledWith(2, { androidRendering, maxApkUploadSizeMb: 256 })
    expect(screen.getByText(/0 differ from the saved setting and 1 have no recorded configuration/)).toBeVisible()
    expect(screen.getByText('Hardware rendering is unverified.')).toBeVisible()

    fireEvent.change(device, { target: { value: '/dev/dri/renderD129' } })
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(device).toHaveValue(androidRendering.renderDevice)
  })

  it('retains drafts after failed saves and server revalidation', async () => {
    vi.mocked(saveOrchestratorUiSettings).mockRejectedValue(new Error('Settings unavailable'))
    const { rerender } = renderForm()
    const registry = await screen.findByLabelText('Image registry')
    fireEvent.change(registry, { target: { value: 'registry.example' } })
    rerender(
      <PlatformRuntimeForm
        images={[]}
        initialSettings={{ ...initialSettings, appListRefreshIntervalSeconds: 10 }}
        appliedRenderingSettings={[]}
      />
    )
    expect(registry).toHaveValue('registry.example')
    fireEvent.submit(screen.getByRole('form', { name: 'Runtime defaults' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'danger' })))
    expect(registry).toHaveValue('registry.example')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('restores defaults only after explaining the service scope and confirming', async () => {
    vi.mocked(resetOrchestratorUiSettings).mockResolvedValue(initialSettings)
    renderForm()
    await screen.findByLabelText('Image registry')
    fireEvent.click(screen.getByRole('button', { name: 'Restore defaults…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Restore runtime defaults?' })
    expect(within(dialog).getByText(/optional service connection settings/)).toBeVisible()
    expect(resetOrchestratorUiSettings).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Restore defaults' }))
    await waitFor(() => expect(resetOrchestratorUiSettings).toHaveBeenCalledOnce())
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('switch', { name: 'Remove app data on delete' })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })
})
