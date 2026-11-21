'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { afterClosingBackEntry, previousPageUrl } from '@/lib/navigation/back-layers'
import { useBackLayer } from './use-back-layer'

type PendingNavigation = { href: string } | { back: true }

export const shouldInterceptNavigationClick = (event: MouseEvent, currentHref: string) => {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return false
  }
  const link = event.target instanceof Element ? event.target.closest('a[href]') : null
  if (!(link instanceof HTMLAnchorElement) || link.target || link.hasAttribute('download')) return false
  const destination = URL.parse(link.href)
  const current = new URL(currentHref)
  if (!destination || !['http:', 'https:'].includes(destination.protocol)) return false
  return (
    destination.origin !== current.origin ||
    destination.pathname !== current.pathname ||
    destination.search !== current.search
  )
}

export const useUnsavedNavigation = ({
  hasUnsavedChanges,
  push,
  preservesDraft,
  onDiscard
}: {
  hasUnsavedChanges: boolean
  push: (href: string) => void
  preservesDraft?: (destination: URL, current: URL) => boolean
  onDiscard?: () => void
}) => {
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null)
  const confirmedNavigationRef = useRef(false)
  useBackLayer(
    hasUnsavedChanges,
    () => {
      const destination = preservesDraft ? previousPageUrl() : null
      if (destination && preservesDraft?.(destination, new URL(window.location.href))) return 'continue'
      setPendingNavigation({ back: true })
    },
    'guard'
  )

  const requestNavigation = (href: string) => {
    if (hasUnsavedChanges) setPendingNavigation({ href })
    else push(href)
  }

  const confirmPendingNavigation = useCallback(() => {
    if (!pendingNavigation) return

    setPendingNavigation(null)
    confirmedNavigationRef.current = true
    onDiscard?.()
    afterClosingBackEntry(() => {
      if ('back' in pendingNavigation) {
        window.history.back()
        return
      }
      const url = new URL(pendingNavigation.href, window.location.href)
      if (url.origin === window.location.origin) {
        push(`${url.pathname}${url.search}${url.hash}`)
        return
      }
      window.location.assign(url.href)
    })
  }, [onDiscard, pendingNavigation, push])

  const cancelPendingNavigation = () => setPendingNavigation(null)

  useEffect(() => {
    confirmedNavigationRef.current = false
    if (!hasUnsavedChanges) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (confirmedNavigationRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (!shouldInterceptNavigationClick(event, window.location.href)) return
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(link instanceof HTMLAnchorElement)) return

      if (preservesDraft?.(new URL(link.href), new URL(window.location.href))) return

      event.preventDefault()
      event.stopPropagation()
      setPendingNavigation({ href: link.href })
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleDocumentClick, true)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleDocumentClick, true)
    }
  }, [hasUnsavedChanges, preservesDraft])

  return {
    confirmPendingNavigation,
    requestNavigation,
    pendingNavigation,
    cancelPendingNavigation
  }
}
