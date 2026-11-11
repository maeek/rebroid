import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FormField } from '@/components/ui/form-field'
import { defaultUserQuota } from '@/shared/permissions/permissions'
import { GroupMembershipPicker } from './group-membership-picker'
import type { UserGroup } from '@/shared/contracts/auth-user'

const groups: UserGroup[] = ['Operators', 'Auditors', 'Support'].map(name => ({
  id: name.toLowerCase(),
  name,
  description: `${name} access`,
  permissions: {},
  quotas: defaultUserQuota,
  createdAt: '',
  updatedAt: ''
}))
const Harness = () => {
  const [value, setValue] = useState(['operators', 'auditors'])
  return (
    <>
      <FormField
        label='Membership'
        description='Groups are applied in order.'
        error='Example error'
        layout='vertical'
      >
        <GroupMembershipPicker
          groups={groups}
          selectedGroupIds={value}
          onChange={setValue}
        />
      </FormField>
      <output data-testid='order'>{value.join(',')}</output>
    </>
  )
}

describe('GroupMembershipPicker', () => {
  it('forwards label, helper, and validation associations to the search input', () => {
    render(<Harness />)
    const input = screen.getByRole('combobox', { name: 'Membership' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Groups are applied in order. Example error')
  })

  it('adds multiple groups and removes selected chips', async () => {
    render(<Harness />)
    const input = screen.getByRole('combobox', { name: 'Membership' })
    fireEvent.click(input)
    fireEvent.input(input, { target: { value: 'support' }, inputType: 'insertText' })
    fireEvent.click(await screen.findByRole('option', { name: /Support/ }))
    expect(screen.getByTestId('order')).toHaveTextContent('operators,auditors,support')
    fireEvent.keyDown(input, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Remove Operators' }))
    expect(screen.getByTestId('order')).toHaveTextContent('auditors,support')
    fireEvent.keyDown(input, { key: 'Escape' })
    await waitFor(() => expect(input).toHaveAttribute('aria-expanded', 'false'))
  })
})
