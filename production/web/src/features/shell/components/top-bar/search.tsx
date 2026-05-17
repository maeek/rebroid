'use client'

import { useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { useSearchSet } from '@/lib/store/search'

export const TopBarProtectedSearch = () => {
  const searchRef = useRef<HTMLInputElement>(null)
  const setSearch = useSearchSet()

  useEffect(() => {
    document.addEventListener('keydown', e => {
      if (e.key === '/') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    })
  }, [])

  return (
    <Input
      placeholder='Type "/" to search'
      type='search'
      className='h-9 placeholder:text-ellipsis'
      ref={searchRef}
      onChange={e => setSearch(e.target.value)}
    />
  )
}
