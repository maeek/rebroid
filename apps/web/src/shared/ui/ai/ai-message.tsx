import type { ReactNode } from 'react'
import { normalizePublicAiText } from '@rebroid/automation-core/ai-public-text'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import { cn } from '@/lib/utils'

export const AiUserMessage = ({ children }: { children: ReactNode }) => (
  <div className='ml-auto grid max-w-[88%] justify-items-end gap-1.5'>
    <span className='px-1 text-xs font-medium uppercase tracking-[0.12em] text-foreground-muted'>You</span>
    <div className='wrap-anywhere whitespace-pre-wrap rounded-feature rounded-br-md bg-primary px-3.5 py-2.5 text-sm leading-6 text-primary-foreground shadow-[0_8px_24px_-16px_hsl(var(--primary)/0.9)]'>
      {children}
    </div>
  </div>
)

export const AiAssistantBlock = ({
  title = 'AI agent',
  meta,
  children,
  className
}: {
  title?: string
  meta?: ReactNode
  children: ReactNode
  className?: string
}) => (
  <div className={cn('flex min-w-0 items-start gap-3', className)}>
    <span className='mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-panel border border-primary/20 bg-primary/8 text-primary shadow-[0_8px_24px_-18px_hsl(var(--primary)/0.8)]'>
      <GradientSparklesIcon className='size-4' />
    </span>
    <div className='grid min-w-0 flex-1 gap-2.5'>
      <div className='flex min-w-0 flex-wrap items-center justify-between gap-2'>
        <span className='truncate text-sm font-medium'>{title}</span>
        {meta ? <div className='shrink-0'>{meta}</div> : null}
      </div>
      {children}
    </div>
  </div>
)

export const AiAssistantText = ({ children, muted }: { children: ReactNode; muted?: boolean }) => (
  <div className={cn('whitespace-pre-wrap text-sm', muted ? 'text-foreground-muted' : 'text-foreground')}>
    {children}
  </div>
)

const markdownComponents: Components = {
  a: ({ children, href }) => {
    const safeHref = typeof href === 'string' && /^(https?:|mailto:)/i.test(href) ? href : undefined
    return (
      <a
        href={safeHref}
        target='_blank'
        rel='noreferrer'
        className='font-medium text-primary underline underline-offset-2'
      >
        {children}
      </a>
    )
  },
  code: ({ children, className }) => (
    <code className={cn('rounded bg-background/35 px-1 py-0.5 font-mono text-[0.85em]', className)}>{children}</code>
  ),
  li: ({ children }) => <li className='pl-1'>{children}</li>,
  ol: ({ children }) => <ol className='my-1 list-decimal space-y-1 pl-5'>{children}</ol>,
  p: ({ children }) => <p className='my-1 first:mt-0 last:mb-0'>{children}</p>,
  pre: ({ children }) => (
    <pre className='my-2 max-h-72 overflow-auto rounded-control bg-background/30 p-2 font-mono text-xs'>{children}</pre>
  ),
  ul: ({ children }) => <ul className='my-1 list-disc space-y-1 pl-5'>{children}</ul>
}

export const AiAssistantMarkdownText = ({
  text,
  muted,
  cursor
}: {
  text: string
  muted?: boolean
  cursor?: ReactNode
}) => (
  <div className={cn('text-sm', muted ? 'text-foreground-muted' : 'text-foreground')}>
    <Markdown
      skipHtml
      remarkPlugins={[remarkGfm]}
      components={markdownComponents}
    >
      {normalizePublicAiText(text)}
    </Markdown>
    {cursor}
  </div>
)

export const AiToolDetails = ({ children, className }: { children: ReactNode; className?: string }) => (
  <dl
    className={cn(
      'grid max-w-full gap-1.5 rounded-panel border border-surface-border/45 bg-background/24 p-2.5 text-xs text-foreground-muted/90',
      className
    )}
  >
    {children}
  </dl>
)
