import { createStore, useStore } from 'zustand'
import { combine } from 'zustand/middleware'

export const searchStore = createStore(
  combine(
    {
      search: ''
    },
    set => ({
      setSearch: (payload: string) => set(() => ({ search: payload }))
    })
  )
)

export const useSearchString = () => useStore(searchStore, state => state.search)
export const useSearchSet = () => useStore(searchStore, state => state.setSearch)
