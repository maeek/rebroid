import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { AutomationGridFilterControls, automationGridFilterSummary } from './automation-grid-filter-controls'

it('keeps a tag named all distinct from clearing the tag filter', async () => {
  const onUpdateGrid = vi.fn()
  const props = { applications: [], tags: ['all'], onUpdateGrid }
  const { rerender } = render(
    <AutomationGridFilterControls
      {...props}
      gridQuery={{}}
    />
  )
  const field = screen.getByRole('combobox', { name: 'Tag' })
  expect(field).toHaveTextContent('All tags')
  fireEvent.click(field)
  const tag = await screen.findByRole('option', { name: 'all' })
  fireEvent.pointerDown(tag, { pointerType: 'mouse' })
  fireEvent.click(tag)
  expect(onUpdateGrid).toHaveBeenCalledWith({ tag: 'all', page: 1 })
  rerender(
    <AutomationGridFilterControls
      {...props}
      gridQuery={{ tag: 'all' }}
    />
  )
  fireEvent.click(field)
  const clear = await screen.findByRole('option', { name: 'All tags' })
  fireEvent.pointerDown(clear, { pointerType: 'mouse' })
  fireEvent.click(clear)
  expect(onUpdateGrid).toHaveBeenLastCalledWith({ tag: undefined, page: 1 })
  expect(automationGridFilterSummary({ ...props, gridQuery: { lastRun: 'all' } })).toEqual([])
})
