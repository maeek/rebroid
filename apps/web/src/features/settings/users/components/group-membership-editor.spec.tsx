import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { defaultUserQuota } from '@/shared/permissions/permissions'
import { GroupMembershipEditor } from './group-membership-editor'
import type { UserGroup } from '@/shared/contracts/auth-user'

const groups: UserGroup[] = Array.from({ length: 13 }, (_, index) => ({
  id: `group-${index}`,
  name: `Group ${index}`,
  description: `Purpose ${index}`,
  permissions: {},
  quotas: defaultUserQuota,
  createdAt: '',
  updatedAt: ''
}))
const Harness = () => {
  const [ids, setIds] = useState(groups.slice(0, 12).map(group => group.id))
  return (
    <>
      <GroupMembershipEditor
        groups={groups}
        selectedGroupIds={ids}
        onChange={setIds}
      />
      <output data-testid='order'>{ids.join(',')}</output>
    </>
  )
}

describe('GroupMembershipEditor', () => {
  it('bounds large memberships with pagination and moves by global priority while filtered', () => {
    render(<Harness />)
    expect(screen.getAllByRole('row')).toHaveLength(6)
    expect(screen.getByText('1-5 of 12')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByRole('link', { name: 'Group 5' })).toBeVisible()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Purpose 11' } })
    expect(screen.getByText('1-1 of 1')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Move Group 11 earlier' }))
    expect(screen.getByTestId('order')).toHaveTextContent('group-9,group-11,group-10')
    fireEvent.click(screen.getByRole('button', { name: 'Remove Group 11' }))
    expect(screen.getByTestId('order')).not.toHaveTextContent('group-11')
    expect(screen.getByText('No matching results')).toBeVisible()
  })

  it('keeps membership edits staged until Apply and discards changes on Cancel', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit membership' }))
    let dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove Group 0' }))
    fireEvent.keyDown(within(dialog).getByRole('combobox'), { key: 'Escape' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.getByTestId('order')).toHaveTextContent('group-0,group-1')
    fireEvent.click(screen.getByRole('button', { name: 'Edit membership' }))
    dialog = screen.getByRole('dialog')
    const input = within(dialog).getByRole('combobox', { name: 'Groups' })
    fireEvent.click(input)
    fireEvent.input(input, { target: { value: 'Group 12' }, inputType: 'insertText' })
    fireEvent.click(await screen.findByRole('option', { name: /Group 12/ }))
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.getByTestId('order')).not.toHaveTextContent('group-12')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apply membership' }))
    expect(screen.getByTestId('order')).toHaveTextContent('group-11,group-12')
  })
})
