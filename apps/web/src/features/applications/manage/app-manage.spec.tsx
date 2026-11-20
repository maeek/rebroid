import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { previewApp } from '@/features/applications/detail/app-resource-preview-data'
import { useApplicationViewerApp } from '@/features/applications/detail/application-viewer-context'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { setAppIconAction } from '@/server/app-icons/actions/set-app-icon-action'
import { updateApplicationAction } from '@/server/orchestrator/applications/actions/configuration/create-update-actions'
import { actionError, actionOk } from '@/shared/actions/action-result'
import { optimizeIconFile } from '@/shared/model/media/icon-metadata'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { AppManage } from './app-manage'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { AndroidApplication } from '@/shared/contracts/application'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('@/features/applications/detail/application-viewer-context', () => ({ useApplicationViewerApp: vi.fn() }))
vi.mock('@/features/applications/detail/app-resource-navigation', () => ({
  AppResourceNavigation: () => <a href='/app/preview-app'>Overview</a>
}))
vi.mock('@/features/applications/viewer/actions/app-viewer-delete-action', () => ({
  AppViewerDeleteAction: () => null
}))
vi.mock('@/features/applications/domain/app-mapper', () => ({ mapAndroidApplicationToAppDefinition: vi.fn() }))
vi.mock('@/server/app-icons/actions/set-app-icon-action', () => ({ setAppIconAction: vi.fn() }))
vi.mock('@/server/orchestrator/applications/actions/configuration/create-update-actions', () => ({
  updateApplicationAction: vi.fn(),
  updateApkAction: vi.fn()
}))
vi.mock('@/shared/model/media/icon-metadata', () => ({ optimizeIconFile: vi.fn() }))
vi.mock('@/shared/model/settings/use-resource-limit-bounds', () => ({
  useResourceLimitBounds: () => ({
    maxMemoryMb: 16384,
    maxCpuCpus: 8,
    hostMemoryBytes: 32 * 1024 ** 3,
    hostCpuCores: 12
  })
}))

const replacement = 'data:image/png;base64,AQ=='
const originalUrl = '/api/app-icons/preview-app'
const updatedUrl = `${originalUrl}?v=updated`

const renderConfiguration = (savedIcon: string | null, settings: Partial<AppDefinition> = {}) => {
  vi.mocked(useApplicationViewerApp).mockImplementation(function useTestApplicationViewerApp() {
    const [app, setApp] = useState<AppDefinition | undefined>(() => ({ ...previewApp, icon: savedIcon, ...settings }))
    return {
      app: app!,
      setApp,
      permissions: {
        'applications:change-resources': true,
        'applications:change-session-limit': true,
        'applications:change-container-args': true
      },
      initialSettings: defaultOrchestratorUiSettings,
      isForeignOwnedApp: false,
      canViewAuditActivity: false
    } as ReturnType<typeof useApplicationViewerApp>
  })
  return render(<AppManage />)
}

const chooseIcon = () => {
  vi.mocked(optimizeIconFile).mockResolvedValue(replacement)
  fireEvent.change(screen.getByLabelText('App icon', { exact: true }), {
    target: { files: [new File(['image'], 'icon.png', { type: 'image/png' })] }
  })
}

it.each([null, originalUrl])('previews an upload or replacement and publishes it on Save (%s)', async savedIcon => {
  vi.mocked(setAppIconAction).mockResolvedValue(actionOk(updatedUrl))
  renderConfiguration(savedIcon)
  const save = screen.getByRole('button', { name: 'Save' })
  expect(save).toBeDisabled()

  chooseIcon()
  expect(screen.getByText('Preparing icon…')).toBeVisible()
  expect(save).toBeDisabled()
  expect(await screen.findByText('New icon')).toBeVisible()
  expect(setAppIconAction).not.toHaveBeenCalled()
  expect(save).toBeEnabled()

  fireEvent.click(save)
  expect(setAppIconAction).toHaveBeenCalledWith(previewApp.id, replacement)
  expect(updateApplicationAction).not.toHaveBeenCalled()
  expect(await screen.findByRole('button', { name: 'Saved' })).toBeVisible()
  expect(screen.getByText('Current icon')).toBeVisible()
})

it('can discard a staged removal or save it to restore the default icon', async () => {
  vi.mocked(setAppIconAction).mockResolvedValue(actionOk(null))
  renderConfiguration(originalUrl)
  fireEvent.click(screen.getByRole('button', { name: 'Remove icon' }))
  expect(screen.getByText('Removal pending')).toBeVisible()
  expect(setAppIconAction).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('link', { name: 'Overview' }))
  expect(await screen.findByRole('dialog', { name: 'Leave without saving?' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Leave page' }))
  expect(await screen.findByText('Current icon')).toBeVisible()
  expect(setAppIconAction).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: 'Remove icon' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(setAppIconAction).toHaveBeenCalledWith(previewApp.id, null)
  expect(await screen.findByText('Default icon')).toBeVisible()
})

it('keeps a failed icon change for retry without resubmitting saved settings', async () => {
  vi.mocked(setAppIconAction)
    .mockResolvedValueOnce(actionError({ message: 'Could not save the icon.' }))
    .mockResolvedValueOnce(actionOk(updatedUrl))
  vi.mocked(updateApplicationAction).mockResolvedValue(actionOk({} as AndroidApplication))
  vi.mocked(mapAndroidApplicationToAppDefinition).mockReturnValue({ ...previewApp, name: 'Renamed' })
  renderConfiguration(originalUrl)
  fireEvent.change(screen.getByRole('textbox', { name: /^Name/ }), { target: { value: 'Renamed' } })
  chooseIcon()
  expect(await screen.findByText('New icon')).toBeVisible()

  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('Other app settings were saved. Could not save the icon.')).toBeVisible()
  expect(screen.getByText('New icon')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('Current icon')).toBeVisible()
  expect(updateApplicationAction).toHaveBeenCalledOnce()
  expect(setAppIconAction).toHaveBeenCalledTimes(2)
})

it.each([
  ['Inactivity timeout', '86401', /Enter a value of 86400 or less/],
  ['Inactivity timeout', '', /Enter a value\./],
  ['RAM limit', '32768', /Enter a value of 16384 or less/],
  ['CPU limit', '0.15', /Enter a value in increments of 0\.1/]
])('blocks Save when %s is set to %s', (label, value, message) => {
  renderConfiguration(null)
  const input = screen.getByRole('spinbutton', { name: label })
  const save = screen.getByRole('button', { name: 'Save' })

  fireEvent.change(input, { target: { value } })
  expect(input).toHaveAttribute('aria-invalid', 'true')
  expect(input).toHaveAccessibleDescription(message)
  expect(save).toBeDisabled()
  fireEvent.click(save)
  expect(updateApplicationAction).not.toHaveBeenCalled()
})

it('sends only the name when renaming an app with existing limits', async () => {
  const settings = { cpuLimitCpus: 16, memoryLimitMb: 4096, containerArgs: 'androidboot.redroid_fps=30' }
  vi.mocked(updateApplicationAction).mockResolvedValue(actionOk({} as AndroidApplication))
  vi.mocked(mapAndroidApplicationToAppDefinition).mockReturnValue({ ...previewApp, ...settings, name: 'New name' })
  renderConfiguration(null, settings)
  const cpu = screen.getByRole('spinbutton', { name: 'CPU limit' })
  expect(cpu).toHaveValue(16)
  fireEvent.blur(cpu)
  expect(cpu).toHaveValue(16)
  expect(cpu).not.toHaveAttribute('aria-invalid', 'true')

  fireEvent.change(screen.getByRole('textbox', { name: /^Name/ }), { target: { value: 'New name' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(updateApplicationAction).toHaveBeenCalledExactlyOnceWith(previewApp.id, { name: 'New name' })
  expect(await screen.findByRole('button', { name: 'Saved' })).toBeVisible()
})

it('clears a saved limit and omits a reverted or already blank limit', async () => {
  const settings = { cpuLimitCpus: 2, memoryLimitMb: 4096 }
  vi.mocked(updateApplicationAction).mockResolvedValue(actionOk({} as AndroidApplication))
  vi.mocked(mapAndroidApplicationToAppDefinition).mockReturnValue({ ...previewApp, ...settings, memoryLimitMb: null })
  renderConfiguration(null, settings)
  const cpu = screen.getByRole('spinbutton', { name: 'CPU limit' })
  const ram = screen.getByRole('spinbutton', { name: 'RAM limit' })
  const save = screen.getByRole('button', { name: 'Save' })

  fireEvent.change(cpu, { target: { value: '' } })
  expect(cpu).toHaveAccessibleDescription(/Unsaved change/)
  expect(save).toBeEnabled()
  fireEvent.change(cpu, { target: { value: '2.0' } })
  expect(cpu).not.toHaveAccessibleDescription(/Unsaved change/)
  expect(save).toBeDisabled()

  fireEvent.click(screen.getByRole('button', { name: 'Reset RAM limit to default' }))
  expect(ram).toHaveValue(null)
  expect(ram).toHaveAccessibleDescription(/Unsaved change/)
  fireEvent.click(save)

  expect(updateApplicationAction).toHaveBeenCalledExactlyOnceWith(previewApp.id, { memoryLimitMb: null })
  expect(await screen.findByRole('button', { name: 'Saved' })).toBeVisible()
  expect(ram).not.toHaveAccessibleDescription(/Unsaved change/)
})
