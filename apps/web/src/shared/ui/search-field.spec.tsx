import { useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SearchField } from './search-field'

const SearchHarness = ({ onSearch }: { onSearch: (value: string) => void }) => {
  const [value, setValue] = useState('')
  return (
    <SearchField
      value={value}
      placeholder='Search resources'
      onValueChange={setValue}
      onSearch={onSearch}
    />
  )
}

describe('SearchField', () => {
  it('keeps the search icon visible and commits after the debounce', () => {
    vi.useFakeTimers()
    const onSearch = vi.fn()
    render(<SearchHarness onSearch={onSearch} />)

    expect(screen.getByTestId('search-field-icon')).toHaveClass('z-10')
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'network' } })
    expect(onSearch).not.toHaveBeenCalled()

    void act(() => vi.advanceTimersByTime(300))
    expect(onSearch).toHaveBeenCalledWith('network')
    vi.useRealTimers()
  })

  it('clears and commits immediately', () => {
    const onSearch = vi.fn()
    render(<SearchHarness onSearch={onSearch} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'image' } })
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(onSearch).toHaveBeenCalledWith('')
  })

  it('commits once when Enter is pressed before the debounce', () => {
    vi.useFakeTimers()
    const onSearch = vi.fn()
    render(<SearchHarness onSearch={onSearch} />)
    const input = screen.getByRole('searchbox')
    fireEvent.change(input, { target: { value: 'container' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    void act(() => vi.advanceTimersByTime(300))
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onSearch).toHaveBeenCalledWith('container')
    vi.useRealTimers()
  })

  it('renders the same icon when disabled', () => {
    render(
      <SearchField
        value=''
        placeholder='Search loading resources'
        disabled
        onValueChange={() => undefined}
      />
    )
    expect(screen.getByTestId('search-field-icon')).toBeTruthy()
    expect(screen.getByRole('searchbox')).toBeDisabled()
  })
})
