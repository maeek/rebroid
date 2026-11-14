'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { IconArrowBackUp, IconArrowForwardUp, IconArrowLeft } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PageContent } from '@/shared/ui/page/page-layout'
import { handleEditorHistoryShortcut, type useAutomationEditorHistory } from './use-automation-editor-history'
import { WorkflowEditorTitle } from './workflow-editor-title'
import styles from './workflow-editor-workspace.module.css'

export const WorkflowEditorWorkspace = ({
  title,
  actions,
  children,
  yamlOpen,
  disabled = false,
  history,
  onRename,
  onToggleYaml
}: {
  title: ReactNode
  actions: ReactNode
  children: ReactNode
  yamlOpen: boolean
  disabled?: boolean
  history?: Pick<ReturnType<typeof useAutomationEditorHistory>, 'canUndo' | 'canRedo' | 'undo' | 'redo'>
  onRename?: (name: string) => void
  onToggleYaml: () => void
}) => {
  const workspaceRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const workspace = workspaceRef.current
    const toolbar = toolbarRef.current
    if (!workspace || !toolbar) return
    const updateToolbarHeight = () => {
      workspace.style.setProperty('--workflow-toolbar-height', `${toolbar.offsetHeight}px`)
    }
    updateToolbarHeight()

    const observer = new ResizeObserver(updateToolbarHeight)
    observer.observe(toolbar)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const workspace = workspaceRef.current
    if (!workspace || !history || disabled) return
    const shortcut = (event: KeyboardEvent) => handleEditorHistoryShortcut(event, history)
    workspace.addEventListener('keydown', shortcut)
    return () => workspace.removeEventListener('keydown', shortcut)
  }, [disabled, history])

  return (
    <div
      ref={workspaceRef}
      className={cn('min-w-0', styles.workspace)}
    >
      <header
        ref={toolbarRef}
        data-workflow-toolbar=''
        className='sticky top-(--workflow-toolbar-top) z-30 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 bg-background px-6 py-3 max-sm:px-4'
      >
        <div className='flex min-w-0 flex-[1_1_15rem] items-center gap-2'>
          <Button
            asChild
            variant='ghost'
            size='icon-md'
          >
            <Link
              href='/automations'
              aria-label='Back to workflows'
              title='Back to workflows'
            >
              <IconArrowLeft />
            </Link>
          </Button>
          <WorkflowEditorTitle
            title={title}
            onRename={disabled || yamlOpen ? undefined : onRename}
          />
        </div>

        <div className='flex min-w-0 max-w-full flex-wrap items-center gap-x-3 gap-y-2'>
          <div className='flex items-center gap-1'>
            <div
              role='group'
              aria-label='Editor mode'
              className='flex items-center gap-1'
            >
              <Button
                type='button'
                size='sm'
                variant={yamlOpen ? 'ghost' : 'secondary'}
                aria-pressed={!yamlOpen}
                disabled={disabled}
                onClick={yamlOpen ? onToggleYaml : undefined}
              >
                Visual editor
              </Button>
              <Button
                type='button'
                size='sm'
                variant={yamlOpen ? 'secondary' : 'ghost'}
                aria-pressed={yamlOpen}
                disabled={disabled}
                onClick={yamlOpen ? undefined : onToggleYaml}
              >
                YAML
              </Button>
            </div>
            <div
              role='group'
              aria-label='Workflow edit history'
              className='flex items-center'
            >
              <Button
                type='button'
                size='icon-sm'
                variant='ghost'
                aria-label='Undo'
                title='Undo (Ctrl/⌘+Z)'
                disabled={disabled || !history?.canUndo}
                onClick={history?.undo}
              >
                <IconArrowBackUp />
              </Button>
              <Button
                type='button'
                size='icon-sm'
                variant='ghost'
                aria-label='Redo'
                title='Redo (Ctrl/⌘+Shift+Z)'
                disabled={disabled || !history?.canRedo}
                onClick={history?.redo}
              >
                <IconArrowForwardUp />
              </Button>
            </div>
          </div>
          <div className='flex min-w-0 max-w-full flex-wrap items-center gap-2'>{actions}</div>
        </div>
      </header>
      <PageContent
        className={cn(
          'pt-(--workflow-workspace-gap)',
          yamlOpen ? 'lg:pb-(--workflow-workspace-gap)' : 'xl:pb-(--workflow-workspace-gap)'
        )}
      >
        <fieldset
          aria-label='Workflow editor'
          disabled={disabled}
          inert={disabled || undefined}
          className='relative z-0 min-w-0'
        >
          {children}
        </fieldset>
      </PageContent>
    </div>
  )
}
