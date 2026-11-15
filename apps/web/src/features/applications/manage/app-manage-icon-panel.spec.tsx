import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { removeAppIconAction } from '@/server/app-icons/actions/remove-app-icon-action'
import { setAppIconAction } from '@/server/app-icons/actions/set-app-icon-action'
import { actionError } from '@/shared/actions/action-result'
import { optimizeIconFile } from '@/shared/model/media/icon-metadata'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { AppManageIconPanel } from './app-manage-icon-panel'

vi.mock('@/server/app-icons/actions/remove-app-icon-action', () => ({ removeAppIconAction: vi.fn() }))
vi.mock('@/server/app-icons/actions/set-app-icon-action', () => ({ setAppIconAction: vi.fn() }))
vi.mock('@/shared/model/media/icon-metadata', () => ({ optimizeIconFile: vi.fn() }))
vi.mock('@/shared/model/settings/use-orchestrator-ui-settings', async importOriginal => ({
  ...(await importOriginal<typeof import('@/shared/model/settings/use-orchestrator-ui-settings')>()),
  useOrchestratorUiSettings: (settings: unknown) => settings
}))

it('keeps the current icon when either immediate mutation fails', async () => {
  const onIconChange = vi.fn()
  vi.mocked(optimizeIconFile).mockResolvedValue('data:image/png;base64,AA==')
  vi.mocked(setAppIconAction).mockResolvedValue(actionError({ message: 'Choose another image.' }))
  vi.mocked(removeAppIconAction).mockResolvedValue(actionError({ message: 'The icon could not be removed.' }))

  render(
    <AppManageIconPanel
      appId='saved-app'
      appName='Saved app'
      icon='data:image/png;base64,AA=='
      initialSettings={defaultOrchestratorUiSettings}
      onIconChange={onIconChange}
    />
  )
  const picker = screen.getByLabelText('App icon', { exact: true })
  const replace = screen.getByRole('button', { name: 'Replace icon' })
  fireEvent.change(picker, { target: { files: [new File(['image'], 'icon.png', { type: 'image/png' })] } })

  expect(screen.getByText('Updating icon…')).toBeVisible()
  expect(replace).toBeDisabled()
  expect(await screen.findByText('Choose another image.')).toBeVisible()
  expect(replace).toBeEnabled()
  expect(screen.getByText('Current icon')).toBeVisible()

  fireEvent.click(screen.getByRole('button', { name: 'Remove icon' }))
  expect(screen.getByRole('button', { name: 'Removing icon…' })).toBeDisabled()
  expect(replace).toBeDisabled()
  expect(await screen.findByText('The icon could not be removed.')).toBeVisible()
  expect(screen.getByText('Current icon')).toBeVisible()
  expect(onIconChange).not.toHaveBeenCalled()
})
