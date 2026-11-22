import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AutomationTagsInput } from './automation-tags-input'

describe('AutomationTagsInput', () => {
  it('adds a new tag from the draft input', () => {
    const onChange = vi.fn()

    render(
      <AutomationTagsInput
        id='tags'
        value={[]}
        onChange={onChange}
      />
    )

    const input = screen.getByLabelText('Tags')
    fireEvent.change(input, { target: { value: 'release' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith([{ name: 'release', color: '#64748b' }])
  })

  it('restores the saved name when another tag already has the requested spelling', () => {
    const onChange = vi.fn()
    render(
      <AutomationTagsInput
        id='tags'
        value={[
          { name: 'release', color: '#64748b' },
          { name: 'stable', color: '#ffffff' }
        ]}
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'release' }))
    const field = screen.getByDisplayValue('release')
    fireEvent.change(field, { target: { value: 'STABLE' } })
    fireEvent.blur(field)
    expect(field).toHaveValue('release')
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Tags')).toHaveAttribute('maxlength', '48')
  })

  it('edits and removes existing tags through the popover', () => {
    const onChange = vi.fn()

    render(
      <AutomationTagsInput
        id='tags'
        value={[{ name: 'release', color: '#64748b' }]}
        onChange={onChange}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'release' }))
    fireEvent.change(screen.getByDisplayValue('release'), { target: { value: 'stable' } })
    fireEvent.keyDown(screen.getByDisplayValue('stable'), { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Remove tag' }))

    expect(onChange).toHaveBeenCalledWith([{ name: 'stable', color: '#64748b' }])
    expect(onChange).toHaveBeenCalledWith([])
  })
})
