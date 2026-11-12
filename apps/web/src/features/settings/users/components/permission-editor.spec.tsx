import { useState } from 'react'
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { resolveEffectiveAccess } from '@/shared/permissions/effective-access'
import { PermissionEditor } from './permission-editor'
import type { UserGroup } from '@/shared/contracts/auth-user'
import type { PermissionMap } from '@/shared/permissions/permissions'

const operators: UserGroup = {
  id: 'operators',
  name: 'Operators',
  description: '',
  permissions: { 'applications:create': true },
  quotas: { maxOpenApps: null, maxSessionSeconds: null, maxMemoryMb: null, maxCpuCpus: null },
  createdAt: '',
  updatedAt: ''
}
const Harness = () => {
  const [permissions, setPermissions] = useState<PermissionMap>({ 'applications:delete': false })
  return (
    <>
      <PermissionEditor
        permissions={permissions}
        onChange={setPermissions}
      />
      <output data-testid='payload'>{JSON.stringify(permissions)}</output>
    </>
  )
}
const selectOption = async (name: string, option: string) => {
  fireEvent.click(screen.getByRole('combobox', { name }))
  const item = await screen.findByRole('option', { name: option })
  fireEvent.pointerDown(item, { pointerType: 'mouse' })
  fireEvent.click(item)
  await waitFor(() => expect(screen.getByRole('combobox', { name })).toHaveTextContent(option))
}
describe('PermissionEditor', () => {
  it('shows the source of an effective permission without a user-level editor', () => {
    const { decisions } = resolveEffectiveAccess([operators], ['operators'])
    render(<PermissionEditor decisions={decisions} />)
    const lifecycle = within(screen.getByRole('rowgroup', { name: 'Application lifecycle' }))
    const create = lifecycle.getByRole('row', { name: /Create applications/ })
    expect(within(create).getByText('Granted', { exact: true })).toBeVisible()
    expect(within(create).getByText('From Operators')).toBeVisible()
    expect(within(create).queryByRole('combobox')).toBeNull()
  })

  it('shows permission categories together and can narrow to one category', async () => {
    render(<Harness />)
    const viewer = within(screen.getByRole('rowgroup', { name: 'Viewer and files' }))
    expect(viewer.getByRole('rowheader', { name: 'Viewer and files' })).toBeVisible()
    expect(viewer.getByRole('combobox', { name: 'Set Transfer files' })).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Set Run AI automations' })).toBeVisible()

    await selectOption('Permission category', 'Viewer and files')
    expect(screen.queryByRole('rowgroup', { name: 'Automations' })).toBeNull()
    expect(viewer.getByRole('combobox', { name: 'Set Transfer files' })).toBeVisible()

    const search = screen.getByRole('searchbox', { name: 'Search permissions' })
    fireEvent.change(search, { target: { value: 'Run ADB' } })
    expect(screen.queryByRole('rowgroup', { name: 'Viewer and files' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Reset view' }))
    expect(screen.getByRole('combobox', { name: 'Set Run ADB shell steps' })).toBeVisible()
  })

  it('searches all categories and edits only the chosen permission', async () => {
    render(<Harness />)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search permissions' }), { target: { value: 'Run ADB' } })
    expect(screen.queryByRole('rowgroup', { name: 'Application lifecycle' })).toBeNull()
    expect(
      within(screen.getByRole('rowgroup', { name: 'Automations' })).getByRole('row', { name: /Run ADB/ })
    ).toBeVisible()
    await selectOption('Set Run ADB shell steps', 'Grant')
    expect(screen.getByTestId('payload')).toHaveTextContent('"automations:run-adb-shell":true')
    expect(screen.getByTestId('payload')).toHaveTextContent('"applications:delete":false')
    await selectOption('Set Run ADB shell steps', 'Deny')
    expect(screen.getByTestId('payload')).toHaveTextContent('"automations:run-adb-shell":false')
    await selectOption('Set Run ADB shell steps', 'Not set')
    expect(screen.getByTestId('payload')).not.toHaveTextContent('automations:run-adb-shell')
    expect(screen.getByRole('combobox', { name: 'Set Run ADB shell steps' })).toHaveAccessibleDescription(
      'Allow automation steps that run Android shell commands.'
    )
  })
})
