import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { act, renderHook } from '@testing-library/react'
import {
  applyAccentColorPreference,
  readDocumentAccentColorPreference,
  useAccentColorPreference
} from './use-accent-color'
import type { AccentColor } from './accent-color'

describe('accent color preference', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-accent')
  })

  it('reads blue when no document preference exists', () => {
    expect(readDocumentAccentColorPreference()).toBe('blue')
  })

  it('ignores unknown document preferences', () => {
    document.documentElement.dataset.accent = 'neon'

    expect(readDocumentAccentColorPreference()).toBe('blue')
  })

  it('applies non-default accent colors to the document element', () => {
    applyAccentColorPreference('purple')

    expect(document.documentElement.getAttribute('data-accent')).toBe('purple')
  })

  it('removes the document accent for the default blue preset', () => {
    document.documentElement.dataset.accent = 'red'

    applyAccentColorPreference('blue')

    expect(document.documentElement.getAttribute('data-accent')).toBeNull()
  })

  it('applies selected accent colors and clears the document attribute for blue', () => {
    const { result } = renderHook(() => useAccentColorPreference({ initialAccentColor: 'purple' }))

    expect(result.current.accentColor).toBe('purple')
    expect(document.documentElement.getAttribute('data-accent')).toBe('purple')

    act(() => {
      result.current.setAccentColor('green')
    })

    expect(result.current.accentColor).toBe('green')
    expect(document.documentElement.getAttribute('data-accent')).toBe('green')

    act(() => {
      result.current.setAccentColor('blue')
    })

    expect(result.current.accentColor).toBe('blue')
    expect(document.documentElement.getAttribute('data-accent')).toBeNull()
  })

  it('persists selected accent colors through the provided save callback', async () => {
    const saveAccentColor = jest.fn<(accentColor: AccentColor) => Promise<void>>().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAccentColorPreference({ saveAccentColor }))

    await act(async () => {
      result.current.setAccentColor('green')
      await Promise.resolve()
    })

    expect(saveAccentColor).toHaveBeenCalledWith('green')
    expect(result.current.accentColor).toBe('green')
    expect(document.documentElement.getAttribute('data-accent')).toBe('green')
  })

  it('reverts optimistic accent changes when persistence fails', async () => {
    const onSaveError = jest.fn()
    const saveAccentColor = jest
      .fn<(accentColor: AccentColor) => Promise<void>>()
      .mockRejectedValue(new Error('failed'))
    const { result } = renderHook(() =>
      useAccentColorPreference({ initialAccentColor: 'purple', saveAccentColor, onSaveError })
    )

    await act(async () => {
      result.current.setAccentColor('red')
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(onSaveError).toHaveBeenCalled()
    expect(result.current.accentColor).toBe('purple')
    expect(document.documentElement.getAttribute('data-accent')).toBe('purple')
  })
})
