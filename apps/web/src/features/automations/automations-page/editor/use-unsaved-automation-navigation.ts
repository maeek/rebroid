import { useCallback, useEffect, useRef, useState } from 'react'

export const unsavedAutomationMessage = 'This workflow has unsaved changes.'

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
  if (!(link instanceof HTMLAnchorElement) || link.target || link.download) return false
  const href = link.href
  if (!href || href.startsWith('mailto:') || href.startsWith('tel:')) return false
  return href !== currentHref
}

export const useUnsavedAutomationNavigation = ({
  hasUnsavedChanges,
  push
}: {
  hasUnsavedChanges: boolean
  push: (href: string) => void
}) => {
  const [pendingNavigationHref, setPendingNavigationHref] = useState<string | null>(null)
  const confirmedNavigationRef = useRef(false)

  const requestNavigation = useCallback(
    (href: string) => {
      if (hasUnsavedChanges) {
        setPendingNavigationHref(href)
        return
      }
      push(href)
    },
    [hasUnsavedChanges, push]
  )

  const confirmPendingNavigation = useCallback(() => {
    const href = pendingNavigationHref
    if (!href) return

    setPendingNavigationHref(null)
    confirmedNavigationRef.current = true
    const url = new URL(href, window.location.href)
    if (url.origin === window.location.origin) {
      push(`${url.pathname}${url.search}${url.hash}`)
      return
    }
    window.location.assign(url.href)
  }, [pendingNavigationHref, push])

  useEffect(() => {
    if (!hasUnsavedChanges) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (confirmedNavigationRef.current) return
      event.preventDefault()
      event.returnValue = unsavedAutomationMessage
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (!shouldInterceptNavigationClick(event, window.location.href)) return
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(link instanceof HTMLAnchorElement)) return

      event.preventDefault()
      event.stopPropagation()
      setPendingNavigationHref(link.href)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleDocumentClick, true)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleDocumentClick, true)
    }
  }, [hasUnsavedChanges])

  return {
    confirmPendingNavigation,
    pendingNavigationHref,
    requestNavigation,
    setPendingNavigationHref
  }
}
