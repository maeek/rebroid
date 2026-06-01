import { createStore, useStore } from 'zustand'
import { combine } from 'zustand/middleware'

type TreeViewElement = {
  id: string
  name: string
  isSelectable?: boolean
  children?: TreeViewElement[]
}

const insertAtTreeRecursively = (tree: TreeViewElement[], payload: TreeViewElement[], insertAt?: string) => {
  for (const element of tree) {
    if (element.id === insertAt) {
      element.children = [...element.children!, ...payload.filter(i => !element.children?.find(sd => sd.id === i.id))]
      return
    }

    if (element.children) {
      insertAtTreeRecursively(element.children, payload, insertAt)
    }
  }
}

export const editorStore = createStore(
  combine(
    {
      treeData: [] as TreeViewElement[]
    },
    set => ({
      updateTreeData: (payload: TreeViewElement[], insertAt?: string) =>
        set(state => {
          // traverse the tree recurively and insert the new data at the correct location
          if (insertAt) {
            const treeData = [...state.treeData]
            insertAtTreeRecursively(treeData, payload, insertAt)
            if (state.treeData.length === 0) return { treeData: payload }

            return { treeData }
          }

          return { treeData: [...state.treeData, ...payload.filter(i => !state.treeData.find(sd => sd.id === i.id))] }
        })
    })
  )
)

export const useEditorTreeData = () => useStore(editorStore, state => state.treeData)
export const useUpdateEditorTreeData = () => useStore(editorStore, state => state.updateTreeData)
