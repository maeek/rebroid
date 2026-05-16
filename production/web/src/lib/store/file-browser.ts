import { createStore, useStore } from 'zustand'

type FileBrowserSelectedItem = {
  index: number
  fullPath: string
  type: 'folder' | 'file'
}

interface FileBrowserStoreState {
  selectedItems: FileBrowserSelectedItem[]
}

interface FileBrowserStoreActions {
  setSelectedItems: (payload: FileBrowserStoreState['selectedItems']) => void
  clearSelectedItems: () => void
  appendOrRemoveSelectedItems: (payload: FileBrowserStoreState['selectedItems']) => void
}

type FileBrowserStore = FileBrowserStoreState & FileBrowserStoreActions

const initialState: FileBrowserStoreState = {
  selectedItems: []
}

export const fileBrowserStore = createStore<FileBrowserStore>(set => ({
  ...initialState,
  setSelectedItems: payload => set({ selectedItems: payload }),
  clearSelectedItems: () => set({ selectedItems: [] }),
  appendOrRemoveSelectedItems: payload =>
    set(state => {
      const selectedPaths = state.selectedItems.map(item => item.fullPath)
      const newItems = payload.filter(item => !selectedPaths.includes(item.fullPath))
      return { selectedItems: [...state.selectedItems, ...newItems] }
    })
}))

export const useFileBrowserSelectedItems = () => useStore(fileBrowserStore, state => state.selectedItems)
export const useFileBrowserSelectedItemsCount = () => useStore(fileBrowserStore, state => state.selectedItems.length)
export const useFileBrowserSetSelectedItems = () => useStore(fileBrowserStore, state => state.setSelectedItems)
export const useFileBrowserClearSelectedItems = () => useStore(fileBrowserStore, state => state.clearSelectedItems)
export const useFileBrowserAppendOrRemoveSelectedItems = () =>
  useStore(fileBrowserStore, state => state.appendOrRemoveSelectedItems)
