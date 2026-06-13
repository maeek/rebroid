'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { accentColorChangeEvent, defaultAccentColor, isAccentColor, type AccentColor } from './accent-color'

export const applyAccentColorPreference = (accentColor: AccentColor) => {
  if (accentColor === defaultAccentColor) {
    document.documentElement.removeAttribute('data-accent')
    return
  }

  document.documentElement.dataset.accent = accentColor
}

export const readDocumentAccentColorPreference = (): AccentColor => {
  if (typeof document === 'undefined') {
    return defaultAccentColor
  }

  const accentColor = document.documentElement.dataset.accent
  return isAccentColor(accentColor) ? accentColor : defaultAccentColor
}

export const useAccentColorPreference = ({
  initialAccentColor = defaultAccentColor,
  onSaveError,
  saveAccentColor
}: {
  initialAccentColor?: AccentColor
  onSaveError?: (error: unknown) => void
  saveAccentColor?: (accentColor: AccentColor) => Promise<unknown>
} = {}) => {
  const [accentColor, setAccentColorState] = useState<AccentColor>(initialAccentColor)
  const persistedAccentColorRef = useRef(initialAccentColor)

  useEffect(() => {
    persistedAccentColorRef.current = initialAccentColor
    setAccentColorState(initialAccentColor)
    applyAccentColorPreference(initialAccentColor)
  }, [initialAccentColor])

  useEffect(() => {
    const onAccentColorChange = (event: Event) => {
      const nextAccentColor = (event as CustomEvent<AccentColor>).detail
      if (!isAccentColor(nextAccentColor)) {
        return
      }

      setAccentColorState(nextAccentColor)
      persistedAccentColorRef.current = nextAccentColor
      applyAccentColorPreference(nextAccentColor)
    }

    window.addEventListener(accentColorChangeEvent, onAccentColorChange)
    return () => {
      window.removeEventListener(accentColorChangeEvent, onAccentColorChange)
    }
  }, [])

  const updateDocumentAccentColor = useCallback((nextAccentColor: AccentColor) => {
    setAccentColorState(nextAccentColor)
    applyAccentColorPreference(nextAccentColor)
    window.dispatchEvent(new CustomEvent(accentColorChangeEvent, { detail: nextAccentColor }))
  }, [])

  const setAccentColor = useCallback(
    (nextAccentColor: AccentColor) => {
      const previousAccentColor = persistedAccentColorRef.current
      updateDocumentAccentColor(nextAccentColor)

      if (!saveAccentColor) {
        persistedAccentColorRef.current = nextAccentColor
        return
      }

      void saveAccentColor(nextAccentColor)
        .then(() => {
          persistedAccentColorRef.current = nextAccentColor
        })
        .catch(error => {
          updateDocumentAccentColor(previousAccentColor)
          onSaveError?.(error)
        })
    },
    [onSaveError, saveAccentColor, updateDocumentAccentColor]
  )

  return { accentColor, setAccentColor }
}
