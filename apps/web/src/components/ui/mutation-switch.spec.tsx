import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { MutationSwitch } from './mutation-switch'

it('keeps the saved value while pending and announces confirmed success', () => {
  const onCheckedChange = vi.fn()
  const { rerender } = render(
    <MutationSwitch
      aria-label='Enable task'
      checked={false}
      pending
      onCheckedChange={onCheckedChange}
    />
  )
  const control = screen.getByRole('switch', { name: 'Enable task' })
  expect(control).toHaveAttribute('aria-busy', 'true')
  expect(control).not.toBeChecked()
  fireEvent.click(control)
  expect(onCheckedChange).not.toHaveBeenCalled()
  expect(screen.getByRole('status')).toHaveTextContent('Saving…')
  rerender(
    <MutationSwitch
      aria-label='Enable task'
      checked
      success
      onCheckedChange={onCheckedChange}
    />
  )
  expect(control).toBeChecked()
  expect(screen.getByRole('status')).toHaveTextContent('Saved')
})
