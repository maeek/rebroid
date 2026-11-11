'use client'

import { useSyncExternalStore } from 'react'
import { readDocumentAccentColorPreference } from '@/shared/model/theme/use-accent-color'
import type { AccentColor } from '@/shared/model/theme/accent-color'

const subscribe = (onAccentChange: () => void) => {
  const observer = new MutationObserver(onAccentChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-accent'] })
  return () => observer.disconnect()
}

export const AccentFavicon = ({ initialAccentColor }: { initialAccentColor: AccentColor | null }) => {
  const accent = useSyncExternalStore(
    subscribe,
    () => (initialAccentColor === null ? null : readDocumentAccentColorPreference()),
    () => initialAccentColor
  )

  return (
    <link
      rel='icon'
      type='image/svg+xml'
      sizes='any'
      href={accent === null ? '/rebroid-icon.svg' : `/favicon/${accent}`}
    />
  )
}
