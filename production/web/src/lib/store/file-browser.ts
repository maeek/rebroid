import { createStore, useStore } from 'zustand'
import { combine } from 'zustand/middleware'

interface FileBrowserStoreState {
  selectedItems: {
    index: number
    fullPath: string
    type: 'folder' | 'file'
  }[]
}

export const fileBrowserStore = createStore(
  combine(
    {
      selectedItems: []
    } as FileBrowserStoreState,
    set => ({
      setSelectedItems: (payload: FileBrowserStoreState['selectedItems']) => set(() => ({ selectedItems: payload })),
      clearSelectedItems: () => set(() => ({ selectedItems: [] })),
      appendOrRemoveSelectedItems: (payload: FileBrowserStoreState['selectedItems']) =>
        set(state => {
          const selectedItems = state.selectedItems.map(item => item.fullPath)
          const newItems = payload.filter(item => !selectedItems.includes(item.fullPath))
          return { selectedItems: [...state.selectedItems, ...newItems] }
        })
    })
  )
)

export const useFileBrowserSelectedItems = () => useStore(fileBrowserStore, state => state.selectedItems)
export const useFileBrowserSelectedItemsCount = () => useStore(fileBrowserStore, state => state.selectedItems.length)
export const useFileBrowserSetSelectedItems = () => useStore(fileBrowserStore, state => state.setSelectedItems)
export const useFileBrowserClearSelectedItems = () => useStore(fileBrowserStore, state => state.clearSelectedItems)
export const useFileBrowserAppendOrRemoveSelectedItems = () =>
  useStore(fileBrowserStore, state => state.appendOrRemoveSelectedItems)
