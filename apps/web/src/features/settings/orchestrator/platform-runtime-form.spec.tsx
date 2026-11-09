import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from '@/hooks/use-toast'
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
    />
  )
beforeEach(() => {
  vi.clearAllMocks()
})

describe('Runtime defaults workflow', () => {
  it('retains an existing draft through an outage and resumes editing after recovery', () => {
    const data = { images: [], initialSettings }
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
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('separates the read-only connection and lets users discard local changes', async () => {
    renderForm()
    const registry = await screen.findByLabelText('Image registry')
    expect(screen.queryByRole('textbox', { name: 'API URL' })).toBeNull()
    expect(screen.getByText(initialSettings.orchestratorApiUrl)).toBeVisible()
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
    await waitFor(() =>
      expect(saveOrchestratorUiSettings).toHaveBeenCalledWith({
        defaultContainerImage: initialSettings.defaultContainerImage,
        dockerImageRegistry: null,
        defaultInactivityTimeoutSeconds: 900,
        maxApkUploadSizeMb: 256,
        removeDataOnDelete: false
      })
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled())
    expect(limit).toHaveValue(256)
    fireEvent.change(limit, { target: { value: '300' } })
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(limit).toHaveValue(256)
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
