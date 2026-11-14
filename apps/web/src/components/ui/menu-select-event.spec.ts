import { expect, it, vi } from 'vitest'
import { handleMenuSelect, type MenuSelectEvent } from './menu-select-event'

const selectionEvent = (defaultPrevented: boolean) =>
  ({
    defaultPrevented,
    preventDefault: vi.fn(),
    preventBaseUIHandler: vi.fn()
  }) as unknown as MenuSelectEvent

it('lets keyboard activation close the menu despite its prevented native default', () => {
  const event = selectionEvent(true)
  const action = vi.fn()
  handleMenuSelect(event, action)
  expect(action).toHaveBeenCalledWith(event)
  expect(event.preventBaseUIHandler).not.toHaveBeenCalled()
})

it.each([false, true])('honors explicit selection cancellation with native defaultPrevented=%s', prevented => {
  const event = selectionEvent(prevented)
  const original = event.preventDefault
  handleMenuSelect(event, selection => selection.preventDefault())
  expect(event.preventBaseUIHandler).toHaveBeenCalledOnce()
  expect(original).toHaveBeenCalledOnce()
  expect(event.preventDefault).toBe(original)
})

it('restores the event even when an action throws', () => {
  const event = selectionEvent(false)
  const original = event.preventDefault
  expect(() =>
    handleMenuSelect(event, () => {
      throw new Error('Failed')
    })
  ).toThrow('Failed')
  expect(event.preventDefault).toBe(original)
})
