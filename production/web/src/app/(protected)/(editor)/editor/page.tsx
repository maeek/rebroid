'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import customTheme from 'monaco-themes/themes/Nord.json'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { trpc } from '@/app/_trpc/client'
import { Button } from '@/components/ui/button'
import { File, Folder, Tree, TreeViewElement } from '@/components/ui/file-tree'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useEditorTreeData, useUpdateEditorTreeData } from '@/lib/store/editor'
import { sanitizePathForPathTraversal } from '@/utils/path-utils'
import './editor.scss'
import { IconDeviceFloppy, IconSettingsCog } from '@tabler/icons-react'

const MonacoEditor = dynamic(() => import('react-monaco-editor'), { ssr: false })

export default function EditorPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const path = sanitizePathForPathTraversal(searchParams.get('path'))
  const [selected, setSelected] = useState<string | null>(null)
  const utils = trpc.useUtils()
  const treeData = useEditorTreeData()
  const updateTreeData = useUpdateEditorTreeData()

  useEffect(() => {
    if (!path) {
      router.replace('/editor?path=/')
    }
  }, [path, router])

  const fetchPath = useCallback(
    async (currentPath: string) => {
      if (utils.files.filesListItems.getData(currentPath)) return
      const data = await utils.files.filesListItems.fetch(currentPath)
      if (!data) return

      updateTreeData(
        data.map(
          item =>
            ({
              id: `${currentPath}/${item.name}`,
              name: item.name,
              isSelectable: true,
              children: item.type === 'folder' ? [] : undefined
            }) as TreeViewElement
        ),
        currentPath
      )
    },
    [utils, updateTreeData]
  )

  const fetchUntilPath = useCallback(async () => {
    const elements: TreeViewElement[] = []

    if (path === '/') {
      return fetchPath('/')
    }

    const paths = path.split('/').filter(Boolean)
    let currentPath = ''

    for (const p of paths) {
      currentPath += `/${p}`
      await fetchPath(currentPath)
    }

    return elements
  }, [path, fetchPath])

  useEffect(() => {
    void fetchUntilPath()
  }, [path, fetchUntilPath])

  const renderFolderStructure = (elements: TreeViewElement[]) => {
    return elements
      .sort(e => (Array.isArray(e.children) ? -1 : 1))
      .map(element => {
        if (element.children) {
          return (
            <Folder
              key={element.id}
              element={element.name}
              value={element.id}
              onClick={() => {
                void fetchPath(element.id)
              }}
            >
              {renderFolderStructure(element.children)}
            </Folder>
          )
        }

        return (
          <File
            key={element.id}
            value={element.id}
            handleSelect={setSelected}
          >
            <p className='text-ellipsis overflow-hidden w-full whitespace-nowrap'>{element.name}</p>
          </File>
        )
      })
  }

  const selectedItem = useMemo(() => {
    const getElementWithParents = (elements: TreeViewElement[], id: string): string => {
      for (const element of elements) {
        if (element.id === id) {
          return element.name
        }

        if (element.children) {
          const result = getElementWithParents(element.children, id)
          if (result) {
            return `${element.name}/${result}`
          }
        }
      }

      return ''
    }

    return selected ? getElementWithParents(treeData, selected) : ''
  }, [selected, treeData])

  return (
    <main className='row-layout h-full'>
      <ResizablePanelGroup
        direction='horizontal'
        className='w-full h-full'
      >
        <ResizablePanel
          defaultSize={20}
          minSize={20}
        >
          <div className='h-[calc(100dvh-2.25rem)] bg-layout'>
            <Tree
              className='p-4 overflow-auto bg-background pb-16'
              elements={treeData}
            >
              {renderFolderStructure(treeData)}
            </Tree>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel minSize={40}>
          <div className='h-full w-full min-w-72'>
            <div className='flex items-center justify-between px-2 py-2 relative rounded-md'>
              <h5 className='text-sm text-ellipsis overflow-hidden w-full flex-1 text-nowrap'>
                {selectedItem || 'Utitled file'}
              </h5>
              <div className='flex gap-2'>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='ghost'
                        size='sm'
                      >
                        <IconDeviceFloppy className='w-4 h-4' />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side='bottom'>
                      <p>Save</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='ghost'
                        size='sm'
                      >
                        <IconSettingsCog className='w-4 h-4' />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side='bottom'>
                      <p>Editor Settings</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <Suspense fallback={<div>Loading...</div>}>
              <MonacoEditor
                language='sql'
                theme='custom-th'
                value={'test'}
                options={{
                  automaticLayout: true,
                  theme: 'custom-th',
                  padding: { top: 10, bottom: 10 },
                  fontSize: 14,
                  scrollbar: {
                    useShadows: false
                  }
                }}
                editorWillMount={monaco => {
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
                  monaco.editor.defineTheme('custom-th', customTheme as any)
                }}
                editorDidMount={() => {}}
                editorWillUnmount={() => {}}
              />
            </Suspense>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  )
}
