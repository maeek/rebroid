'use client'

import { useEffect, useRef, useState, useTransition } from 'react'

const hrefKey = (href: string) => {
  const [path, search] = href.split('?')
  const params = new URLSearchParams(search)
  params.sort()
  return `${path}?${params}`
}

export const useRoutedGridQuery = <TQuery>({
  committedQuery,
  hrefFor,
  searchFrom,
  navigate
}: {
  committedQuery: TQuery
  hrefFor: (query: TQuery) => string
  searchFrom: (query: TQuery) => string | undefined
  navigate: (href: string) => void
}) => {
  const committedSearch = searchFrom(committedQuery) ?? ''
  const committedKey = hrefKey(hrefFor(committedQuery))
  const [query, setQuery] = useState(committedQuery)
  const [searchDraft, setSearchDraft] = useState(committedSearch)
  const [isNavigating, startNavigation] = useTransition()
  const committed = useRef({ key: committedKey, query: committedQuery, search: committedSearch })
  const intent = useRef({ query: committedQuery, key: committedKey, requests: new Set<string>() })
  const submittedSearch = useRef<string | undefined>(undefined)

  useEffect(() => {
    const resetIntent = () => {
      intent.current = { query: committed.current.query, key: committed.current.key, requests: new Set() }
      submittedSearch.current = undefined
      setQuery(committed.current.query)
      setSearchDraft(committed.current.search)
    }
    window.addEventListener('popstate', resetIntent)
    return () => window.removeEventListener('popstate', resetIntent)
  }, [])

  useEffect(() => {
    if (committedKey === committed.current.key) return
    committed.current = { key: committedKey, query: committedQuery, search: committedSearch }
    const { key: latestKey, requests } = intent.current
    // Server validation can normalize the query while the URL retains the requested values.
    const requestedKey = requests.has(committedKey)
      ? committedKey
      : hrefKey(`${window.location.pathname}${window.location.search}`)
    const wasRequested = requests.has(requestedKey)
    // An earlier response may update the rows while a more recent query is still pending.
    if (wasRequested && requestedKey !== latestKey) return

    const submitted = submittedSearch.current
    submittedSearch.current = undefined
    intent.current = { query: committedQuery, key: committedKey, requests: new Set() }
    setQuery(committedQuery)
    setSearchDraft(draft => (!wasRequested || draft === submitted ? committedSearch : draft))
  }, [committedKey, committedQuery, committedSearch])

  const submit = (update: (current: TQuery) => TQuery, options?: { href?: string; search?: string }) => {
    const next = update(intent.current.query)
    const href = hrefFor(next)
    const key = hrefKey(href)
    if (options?.search !== undefined) {
      submittedSearch.current = options.search
      setSearchDraft(options.search)
    }
    if (key === intent.current.key && !options?.href) return

    const requests = intent.current.requests
    if (key !== committed.current.key || requests.size) requests.add(key)
    intent.current = { query: next, key, requests }
    setQuery(next)
    startNavigation(() => navigate(options?.href ?? href))
  }

  return { query, searchDraft, setSearchDraft, isNavigating, submit }
}
