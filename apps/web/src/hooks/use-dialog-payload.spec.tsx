import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useDialogPayload } from './use-dialog-payload'

describe('useDialogPayload', () => {
  it('retains the latest draft through closing and releases it after the transition', () => {
    const initialProps: { value: string | null } = { value: 'Initial draft' }
    const { result, rerender } = renderHook(({ value }: { value: string | null }) => useDialogPayload(value), {
      initialProps
    })
    rerender({ value: 'Updated draft' })
    rerender({ value: null })
    expect(result.current.payload).toBe('Updated draft')
    act(() => result.current.onOpenChangeComplete(false))
    expect(result.current.payload).toBeNull()
    rerender({ value: 'Another record' })
    act(() => result.current.onOpenChangeComplete(true))
    expect(result.current.payload).toBe('Another record')
  })
})
