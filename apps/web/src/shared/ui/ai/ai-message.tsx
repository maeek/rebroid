import type { ReactNode } from 'react'
import { normalizePublicAiText } from '@rebroid/automation-core/ai-public-text'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

export const AiUserMessage = ({ children }: { children: ReactNode }) => (
  <div
    className='ml-auto grid max-w-[88%] justify-items-end'
    aria-label='Your message'
  >
    <div className='wrap-anywhere whitespace-pre-wrap rounded-feature bg-surface-editor px-4 py-3 text-sm leading-6 text-foreground'>
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
  <div className={cn('min-w-0', className)}>
    <div className='grid min-w-0 flex-1 gap-2.5'>
      <div className='flex min-w-0 flex-wrap items-center gap-2'>
        <span className='text-xs font-medium text-foreground-muted'>{title}</span>
        {meta ? <div className='shrink-0'>{meta}</div> : null}
      </div>
      {children}
    </div>
  </div>
)

export const AiAssistantText = ({ children, muted }: { children: ReactNode; muted?: boolean }) => (
  <div
    className={cn(
      'wrap-anywhere whitespace-pre-wrap text-sm leading-6',
      muted ? 'text-foreground-muted' : 'text-foreground'
    )}
  >
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
    <pre className='my-3 max-h-72 max-w-full overflow-auto rounded-control bg-surface-editor p-3 font-mono text-xs leading-5'>
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className='my-3 overflow-x-auto'>
      <table className='w-full text-left text-sm'>{children}</table>
    </div>
  ),
  th: ({ children }) => <th className='px-3 py-2 font-medium'>{children}</th>,
  td: ({ children }) => <td className='border-t border-surface-border/40 px-3 py-2 align-top'>{children}</td>,
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
  <div className={cn('min-w-0 wrap-anywhere text-sm leading-6', muted ? 'text-foreground-muted' : 'text-foreground')}>
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
  <dl className={cn('grid max-w-full gap-2 text-xs leading-5 text-foreground-muted', className)}>{children}</dl>
)
