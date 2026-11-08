'use client'

import { editorSectionClassName } from '@/components/ui/surface'
import { cn } from '@/lib/utils'
import { CodeViewer } from '@/shared/ui/code-viewer'

const JsonTokens = ({ output }: { output: string }) => (
  <>
    {output
      .split(/("(?:[^"\\]|\\.)*"\s*:|"(?:[^"\\]|\\.)*"|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g)
      .map((token, index) => {
        let color = 'text-foreground-muted'
        if (token.startsWith('"')) color = token.trimEnd().endsWith(':') ? 'text-primary' : 'text-foreground'
        else if (/^(true|false|null)$/.test(token)) color = 'text-warning'
        else if (/^-?\d/.test(token)) color = 'text-info'
        return (
          <span
            key={index}
            className={color}
          >
            {token}
          </span>
        )
      })}
  </>
)

export const JsonViewer = ({
  value,
  title = 'JSON',
  className,
  loading = false
}: {
  value: unknown
  title?: string
  className?: string
  loading?: boolean
}) => {
  const output = JSON.stringify(value, null, 2) ?? 'null'

  return (
    <CodeViewer
      title={title}
      formatLabel='JSON'
      output={output}
      loading={loading}
      className={cn(editorSectionClassName, className)}
    >
      <JsonTokens output={output} />
    </CodeViewer>
  )
}
