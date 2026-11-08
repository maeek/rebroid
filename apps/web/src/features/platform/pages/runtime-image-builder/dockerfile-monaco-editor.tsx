'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { Skeleton } from '@/components/ui/skeleton'
import { controlSurfaceClassName } from '@/components/ui/surface'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type * as Monaco from 'monaco-editor'

export const dockerfileEditorHeight = 'h-[clamp(22rem,50dvh,36rem)] min-h-[22rem]'

export const DockerfileMonacoEditor = ({
  value,
  className,
  onChange,
  disabled = false,
  loading = false
}: {
  value: string
  className?: string
  disabled?: boolean
  loading?: boolean
  onChange: (value: string) => void
}) => {
  const editorId = useId()
  const { resolvedTheme } = useTheme()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const modelRef = useRef<Monaco.editor.ITextModel | null>(null)
  const monacoRef = useRef<typeof Monaco | null>(null)
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const [fallbackReason, setFallbackReason] = useState<string | null>(null)
  const monacoTheme = resolvedTheme === 'light' ? 'rebroid-dockerfile-light' : 'rebroid-dockerfile-dark'
  const themeRef = useRef(monacoTheme)
  const disabledRef = useRef(disabled)

  useEffect(() => {
    themeRef.current = monacoTheme
    disabledRef.current = disabled
    valueRef.current = value
    onChangeRef.current = onChange
  }, [disabled, monacoTheme, onChange, value])

  useEffect(() => {
    if (loading || !containerRef.current || editorRef.current || fallbackReason) return
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

        for (const base of ['vs', 'vs-dark'] as const) {
          monaco.editor.defineTheme(base === 'vs' ? 'rebroid-dockerfile-light' : 'rebroid-dockerfile-dark', {
            base,
            inherit: true,
            rules: [],
            colors: {
              'editor.background': '#00000000',
              'editorGutter.background': '#00000000',
              'editor.lineHighlightBorder': '#00000000'
            }
          })
        }
        const uri = monaco.Uri.parse(`inmemory://rebroid/${encodeURIComponent(editorId)}/Dockerfile`)
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
          fontSize: 13,
          lineHeight: 22,
          padding: { top: 16, bottom: 16 },
          ariaLabel: 'Dockerfile',
          readOnly: disabledRef.current,
          tabSize: 2,
          wordWrap: 'on',
          theme: themeRef.current
        })
        contentDisposable = model.onDidChangeContent(() => onChangeRef.current(model.getValue()))
      } catch (error) {
        if (disposed) return
        setFallbackReason(error instanceof Error ? error.message : 'Monaco failed to load.')
      }
    }

    void initialize()

    return () => {
      disposed = true
      contentDisposable?.dispose()
      editorRef.current?.dispose()
      editorRef.current = null
      modelRef.current?.dispose()
      modelRef.current = null
      monacoRef.current = null
    }
  }, [editorId, fallbackReason, loading])

  useEffect(() => {
    const model = modelRef.current
    if (model && model.getValue() !== value) {
      model.setValue(value)
    }
  }, [value])

  useEffect(() => {
    monacoRef.current?.editor.setTheme(monacoTheme)
  }, [monacoTheme])
  useEffect(() => {
    editorRef.current?.updateOptions({ readOnly: disabled })
  }, [disabled])

  if (loading) return <Skeleton className={cn(dockerfileEditorHeight, className)} />

  if (fallbackReason) {
    return (
      <Textarea
        value={value}
        disabled={disabled}
        className={cn(dockerfileEditorHeight, 'resize-y font-mono text-sm', className)}
        aria-label='Dockerfile'
        onChange={event => onChange(event.target.value)}
      />
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn(dockerfileEditorHeight, 'overflow-hidden rounded-control', controlSurfaceClassName, className)}
      aria-label='Dockerfile editor'
    />
  )
}
