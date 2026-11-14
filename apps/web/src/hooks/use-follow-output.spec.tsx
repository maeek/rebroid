import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useFollowOutput } from './use-follow-output'

describe('useFollowOutput', () => {
  it('pauses while reading, resumes at the bottom, and never scrolls the page', () => {
    const output = document.createElement('pre')
    Object.defineProperty(output, 'scrollHeight', { configurable: true, value: 1000 })
    Object.defineProperty(output, 'clientHeight', { configurable: true, value: 200 })
    output.scrollTo = vi.fn((options?: ScrollToOptions | number) => {
      if (typeof options === 'object')
        output.scrollTop = Math.min(options.top ?? 0, output.scrollHeight - output.clientHeight)
    })
    const { result, rerender } = renderHook(({ text, enabled }) => useFollowOutput<HTMLPreElement>(text, enabled), {
      initialProps: { text: 'first', enabled: true }
    })
    result.current.outputRef.current = output
    rerender({ text: 'second', enabled: true })
    expect(output.scrollTop).toBe(800)
    output.scrollTop = 200
    act(() => result.current.onScroll())
    expect(result.current.isAtBottom).toBe(false)
    rerender({ text: 'third', enabled: true })
    expect(output.scrollTop).toBe(200)
    act(() => result.current.scrollToLatest())
    expect(output.scrollTop).toBe(800)
    expect(result.current.isAtBottom).toBe(true)
    Object.defineProperty(output, 'scrollHeight', { configurable: true, value: 1200 })
    rerender({ text: 'fourth', enabled: true })
    expect(output.scrollTop).toBe(1000)
    output.scrollTop = 300
    act(() => result.current.onScroll())
    rerender({ text: 'fifth', enabled: false })
    expect(output.scrollTop).toBe(300)
    rerender({ text: 'sixth', enabled: true })
    expect(output.scrollTop).toBe(1000)
    expect(output.scrollTo).toHaveBeenLastCalledWith({ top: 1200, behavior: 'instant' })
  })
})
