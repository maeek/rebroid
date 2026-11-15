'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { IconArrowBackUp, IconArrowForwardUp, IconChevronLeft } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { pageBackButtonClassName } from '@/shared/ui/page/page-breadcrumbs'
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
      className={cn('min-w-0', styles.workspace, yamlOpen && styles.yamlWorkspace)}
    >
      <header
        ref={toolbarRef}
        data-workflow-toolbar=''
        className={cn(
          'sticky top-(--workflow-toolbar-top) z-30 flex min-w-0 flex-col gap-x-4 gap-y-2 bg-background px-(--page-inline-gutter) pt-(--page-header-top-inset) pb-3 lg:flex-row lg:flex-wrap lg:items-start',
          styles.toolbar
        )}
      >
        <div className='flex min-w-0 items-start gap-0.5 lg:flex-[1_1_15rem]'>
          <Button
            asChild
            variant='ghost'
            size='icon-md'
            className={pageBackButtonClassName}
          >
            <Link
              href='/automations'
              aria-label='Back to workflows'
              title='Back to workflows'
            >
              <IconChevronLeft aria-hidden />
            </Link>
          </Button>
          <div className='flex min-h-(--page-header-control-size) min-w-0 flex-1 items-center'>
            <WorkflowEditorTitle
              title={title}
              onRename={disabled || yamlOpen ? undefined : onRename}
            />
          </div>
        </div>

        <div
          className={cn(
            'flex min-h-(--page-header-control-size) min-w-0 items-center justify-between gap-2 lg:gap-3',
            styles.controls
          )}
        >
          <div className={cn('flex items-center gap-1', styles.controls)}>
            <div
              role='group'
              aria-label='Editor mode'
              className='hidden items-center gap-1 lg:flex'
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
              className={cn('flex items-center', styles.historyControls)}
            >
              <Button
                type='button'
                size='icon-sm'
                variant='ghost'
                aria-label='Undo'
                title='Undo (Ctrl/⌘+Z)'
                className='max-lg:size-11'
                disabled={disabled || !history?.canUndo}
                onClick={history?.undo}
              >
                <IconArrowBackUp aria-hidden />
              </Button>
              <Button
                type='button'
                size='icon-sm'
                variant='ghost'
                aria-label='Redo'
                title='Redo (Ctrl/⌘+Shift+Z)'
                className='max-lg:size-11'
                disabled={disabled || !history?.canRedo}
                onClick={history?.redo}
              >
                <IconArrowForwardUp aria-hidden />
              </Button>
            </div>
          </div>
          <div className={cn('flex items-center gap-2', styles.controls)}>{actions}</div>
        </div>
      </header>
      <PageContent
        className={cn(
          'pt-(--workflow-workspace-gap)',
          yamlOpen ? 'min-h-0 pb-(--workflow-workspace-gap)' : 'xl:pb-(--workflow-workspace-gap)'
        )}
      >
        <fieldset
          aria-label='Workflow editor'
          disabled={disabled}
          inert={disabled || undefined}
          className={cn('relative z-0 min-w-0', yamlOpen && 'flex min-h-0 flex-1 flex-col')}
        >
          {children}
        </fieldset>
      </PageContent>
    </div>
  )
}
