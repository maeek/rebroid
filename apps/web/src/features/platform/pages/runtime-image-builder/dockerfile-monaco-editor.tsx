'use client'

import { useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type * as Monaco from 'monaco-editor'

export const DockerfileMonacoEditor = ({
  value,
  className,
  onChange
}: {
  value: string
  className?: string
  onChange: (value: string) => void
}) => {
  const { resolvedTheme } = useTheme()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const modelRef = useRef<Monaco.editor.ITextModel | null>(null)
  const monacoRef = useRef<typeof Monaco | null>(null)
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const [fallbackReason, setFallbackReason] = useState<string | null>(null)
  const monacoTheme = resolvedTheme === 'light' ? 'vs' : 'vs-dark'

  useEffect(() => {
    valueRef.current = value
    onChangeRef.current = onChange
  }, [onChange, value])

  useEffect(() => {
    if (!containerRef.current || editorRef.current || fallbackReason) return
    let disposed = false
    let contentDisposable: Monaco.IDisposable | null = null

    const initialize = async () => {
      try {
        const monaco = await import('monaco-editor')
        if (disposed || !containerRef.current) return
        monacoRef.current = monaco
        if (!monaco.languages.getLanguages().some(language => language.id === 'dockerfile')) {
          monaco.languages.register({ id: 'dockerfile', extensions: ['Dockerfile'], aliases: ['Dockerfile'] })
        }

        const uri = monaco.Uri.parse('file:///Rebroid.Dockerfile')
        const existingModel = monaco.editor.getModel(uri)
        const model = existingModel ?? monaco.editor.createModel(valueRef.current, 'dockerfile', uri)
        if (existingModel && existingModel.getValue() !== valueRef.current) {
          existingModel.setValue(valueRef.current)
        }
        modelRef.current = model
        editorRef.current = monaco.editor.create(containerRef.current, {
          model,
          automaticLayout: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 12,
          tabSize: 2,
          wordWrap: 'on',
          theme: monacoTheme
        })
        contentDisposable = model.onDidChangeContent(() => onChangeRef.current(model.getValue()))
      } catch (error) {
        setFallbackReason(error instanceof Error ? error.message : 'Monaco failed to load.')
      }
    }

    void initialize()

    return () => {
      disposed = true
      contentDisposable?.dispose()
      editorRef.current?.dispose()
      editorRef.current = null
      modelRef.current = null
      monacoRef.current = null
    }
  }, [fallbackReason, monacoTheme])

  useEffect(() => {
    const model = modelRef.current
    if (model && model.getValue() !== value) {
      model.setValue(value)
    }
  }, [value])

  useEffect(() => {
    void import('monaco-editor').then(monaco => {
      monaco.editor.setTheme(monacoTheme)
    })
  }, [monacoTheme])

  if (fallbackReason) {
    return (
      <Textarea
        value={value}
        className={cn('min-h-[34rem] resize-y font-mono text-xs', className)}
        aria-label='Dockerfile'
        onChange={event => onChange(event.target.value)}
      />
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn('min-h-[34rem] overflow-hidden rounded-md border border-border/60', className)}
      aria-label='Dockerfile editor'
    />
  )
}
