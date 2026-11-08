'use client'
import { ReactNode, useContext, useEffect, useId, useRef, useState } from 'react'
import { IconChevronDown } from '@tabler/icons-react'
import { EditorFormContext, EditorSectionContext } from '@/components/ui/editor-form-context'
import { bandSurfaceClassName, editorSectionClassName, panelSurfaceClassName } from '@/components/ui/surface'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'

export type SectionSurface = 'plain' | 'band' | 'panel'
export type SectionHeadingSpacing = 'none' | 'compact' | 'default'

interface SectionProps {
  actions?: ReactNode
  children?: ReactNode
  className?: string
  collapsible?: boolean
  contentClassName?: string
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  summary?: ReactNode
  description?: ReactNode
  headingLevel?: 2 | 3
  headingSpacing?: SectionHeadingSpacing
  orientation?: 'horizontal' | 'vertical'
  surface: SectionSurface
  title?: ReactNode
  titleClassName?: string
}

export const Section = ({
  className,
  children,
  title,
  orientation = 'vertical',
  collapsible,
  contentClassName,
  defaultOpen = false,
  open,
  onOpenChange,
  summary,
  description,
  headingLevel = 2,
  headingSpacing = 'default',
  actions,
  titleClassName,
  surface
}: SectionProps) => {
  const inEditor = useContext(EditorFormContext)
  const insideEditorSection = useContext(EditorSectionContext)
  const editorContainer = inEditor && !insideEditorSection && !collapsible
  const editorExpansion = inEditor && !insideEditorSection && Boolean(collapsible)
  const effectiveSurface = inEditor ? 'plain' : surface
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isOpen = open ?? internalOpen
  const contentId = useId()
  const contentRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = contentRef.current
    if (!node || !collapsible || isOpen) return
    const revealErrors = () => {
      if (node.querySelector('[aria-invalid="true"], [role="alert"]')) {
        setInternalOpen(true)
        onOpenChange?.(true)
      }
    }
    revealErrors()
    const observer = new MutationObserver(revealErrors)
    observer.observe(node, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['aria-invalid', 'role']
    })
    return () => observer.disconnect()
  }, [collapsible, isOpen, onOpenChange])
  const setIsOpen = (next: boolean) => {
    setInternalOpen(next)
    onOpenChange?.(next)
  }
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  const panelCollapsible = effectiveSurface === 'panel' && Boolean(collapsible)
  const content = (
    <div
      className={cn('flex min-w-0', inEditor && 'gap-4', contentClassName, {
        'flex-col': orientation === 'vertical'
      })}
    >
      <EditorSectionContext.Provider value={insideEditorSection || editorContainer || editorExpansion}>
        {children}
      </EditorSectionContext.Provider>
    </div>
  )

  return (
    <section
      aria-label={typeof title === 'string' ? title : undefined}
      data-slot='section'
      data-surface={editorContainer ? 'editor' : effectiveSurface}
      className={cn(
        'flex flex-col w-full rounded-panel',
        {
          [cn(bandSurfaceClassName, 'p-6 max-sm:p-4')]: effectiveSurface === 'band',
          [cn(panelSurfaceClassName, 'p-6 max-sm:p-4')]: effectiveSurface === 'panel',
          'p-0': panelCollapsible
        },
        editorContainer && editorSectionClassName,
        className
      )}
    >
      <Visible when={title}>
        {collapsible ? (
          <button
            type='button'
            aria-expanded={isOpen}
            aria-controls={contentId}
            className={cn(
              'flex w-full items-center justify-between text-left',
              { 'px-6 py-5 max-sm:px-4 max-sm:py-4': panelCollapsible },
              titleClassName
            )}
            onClick={() => setIsOpen(!isOpen)}
          >
            <span className='grid gap-1'>
              <Heading className='font-medium'>{title}</Heading>
              {summary ? <span className='text-xs text-foreground-muted'>{summary}</span> : null}
              <Visible when={description}>
                <span className='text-sm font-normal text-foreground-muted'>{description}</span>
              </Visible>
            </span>
            <IconChevronDown
              className={cn('transition', {
                '-rotate-180': isOpen
              })}
            />
          </button>
        ) : (
          <div
            data-slot='section-heading'
            data-testid='section-heading'
            data-heading-spacing={headingSpacing}
            className={cn(
              'flex items-start justify-between gap-4',
              {
                'pb-0': headingSpacing === 'none',
                'pb-2': headingSpacing === 'compact',
                'pb-4': headingSpacing === 'default'
              },
              titleClassName
            )}
          >
            <div className='grid gap-1'>
              <Heading className='font-medium'>{title}</Heading>
              <Visible when={description}>
                <p className='text-sm text-foreground-muted'>{description}</p>
              </Visible>
            </div>
            <Visible when={actions}>
              <div className='flex shrink-0 items-center gap-2'>{actions}</div>
            </Visible>
          </div>
        )}
      </Visible>

      <Visible when={title && collapsible}>
        <div
          ref={contentRef}
          id={contentId}
          inert={!isOpen}
          aria-hidden={!isOpen}
          onInvalidCapture={() => setIsOpen(true)}
          className={cn(
            'grid overflow-hidden transition-[grid-template-rows,opacity,padding-top,padding-bottom] duration-200 ease-out',
            {
              'px-6 max-sm:px-4': panelCollapsible,
              'grid-rows-[1fr] opacity-100': isOpen,
              'pt-4': isOpen && !panelCollapsible && headingSpacing === 'default',
              'pt-2': isOpen && (panelCollapsible || headingSpacing === 'compact'),
              'pb-6 max-sm:pb-4': isOpen && panelCollapsible,
              'mt-4': isOpen && editorExpansion,
              'grid-rows-[0fr] opacity-0 pt-0 pb-0': !isOpen
            },
            editorExpansion && isOpen && editorSectionClassName
          )}
        >
          <div className='min-h-0'>{content}</div>
        </div>
      </Visible>
      <Visible when={!(title && collapsible)}>{content}</Visible>
    </section>
  )
}
