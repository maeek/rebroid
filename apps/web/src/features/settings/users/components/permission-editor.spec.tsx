import { useState } from 'react'
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PermissionEditor } from './permission-editor'
import type { PermissionMap } from '@/shared/permissions/permissions'

const inherited = { 'applications:create': { allowed: true, source: 'Operators' } }
const Harness = ({ admin = false, group = false }: { admin?: boolean; group?: boolean }) => {
  const [permissions, setPermissions] = useState<PermissionMap>({ 'applications:delete': false })
  return (
    <>
      <PermissionEditor
        permissions={permissions}
        onChange={setPermissions}
        inheritedPermissions={group ? undefined : inherited}
        admin={admin}
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
const row = (name: string) => screen.getAllByRole('row').find(item => within(item).queryByText(name, { exact: true }))!

describe('PermissionEditor', () => {
  it('separates inherited access and overrides, and removes an override when Inherit is chosen', async () => {
    render(<Harness />)
    expect(within(row('Create applications')).getByText('Granted', { exact: true })).toBeVisible()
    expect(within(row('Create applications')).getByText('From Operators')).toBeVisible()
    await selectOption('Override Create applications', 'Deny')
    expect(within(row('Create applications')).getByText('Not granted', { exact: true })).toBeVisible()
    expect(screen.getByTestId('payload')).toHaveTextContent('"applications:create":false')
    await selectOption('Override Create applications', 'Inherit')
    expect(screen.getByTestId('payload')).not.toHaveTextContent('applications:create')
    expect(screen.getByTestId('payload')).toHaveTextContent('"applications:delete":false')
    expect(within(row('Create applications')).getByText('From Operators')).toBeVisible()
  })

  it('searches all categories and edits only the chosen permission', async () => {
    render(<Harness group />)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search permissions' }), { target: { value: 'Run ADB' } })
    expect(screen.queryByText('Create applications', { exact: true })).toBeNull()
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

  it('filters to explicit overrides and can reset them without changing membership', async () => {
    render(<Harness />)
    await selectOption('Show', 'User overrides')
    expect(screen.queryByText('Create applications', { exact: true })).toBeNull()
    expect(screen.getByText('Delete applications', { exact: true })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Reset all overrides' }))
    expect(screen.getByTestId('payload')).toHaveTextContent('{}')
    expect(screen.getByText('No permissions match these filters.')).toBeVisible()
  })

  it('does not pretend a user override can restrict an administrator', () => {
    render(<Harness admin />)
    expect(screen.getByText('28 of 28 permissions granted')).toBeVisible()
    expect(within(row('Delete applications')).getByText('Granted', { exact: true })).toBeVisible()
    expect(screen.queryByRole('combobox', { name: 'Set Delete applications' })).toBeNull()
    expect(screen.queryByRole('combobox', { name: 'Override Delete applications' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reset all overrides' })).toBeNull()
    expect(screen.getByTestId('payload')).toHaveTextContent('"applications:delete":false')
  })
})
