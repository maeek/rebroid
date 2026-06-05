'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import classNames from 'classnames'
import { useTheme } from 'next-themes'
import { Textarea } from '@/components/ui/textarea'
import { createAutomationYamlCompletionProvider } from './language/automation-yaml-completions'
import {
  automationYamlMarkerOwner,
  configureAutomationYamlLanguage,
  disableAutomationYamlLanguage,
  isAutomationYamlWorkerRequestHandlerError
} from './language/automation-yaml-service'
import { validateAutomationYamlModel } from './language/automation-yaml-validation'
import { registerAutomationMonacoWorkers } from './language/automation-yaml-workers'
import { buildAutomationYamlSchema } from './schema/automation-yaml-schema'
import type { AutomationCommand } from '@/server/orchestrator/automations/types'
import type * as Monaco from 'monaco-editor'

const defaultModelUri = 'file:///rebroid-automation.yaml'

export function AutomationMonacoYamlEditor({
  value,
  commands,
  schema,
  modelUri = defaultModelUri,
  className,
  ariaLabel = 'Automation YAML',
  onChange,
  onValidationChange
}: {
  value: string
  commands?: AutomationCommand[]
  schema?: Record<string, unknown>
  modelUri?: string
  className?: string
  ariaLabel?: string
  onChange: (value: string) => void
  onValidationChange?: (valid: boolean, messages: string[]) => void
}) {
  const { resolvedTheme } = useTheme()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const modelRef = useRef<Monaco.editor.ITextModel | null>(null)
  const monacoRef = useRef<typeof Monaco | null>(null)
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const onValidationChangeRef = useRef(onValidationChange)
  const [fallbackReason, setFallbackReason] = useState<string | null>(null)
  const resolvedCommands = useMemo(() => commands ?? [], [commands])
  const resolvedSchema = useMemo(() => schema ?? buildAutomationYamlSchema(commands ?? []), [commands, schema])
  const monacoTheme = resolvedTheme === 'light' ? 'vs' : 'vs-dark'

  useEffect(() => {
    valueRef.current = value
    onChangeRef.current = onChange
  }, [onChange, value])

  useEffect(() => {
    onValidationChangeRef.current = onValidationChange
  }, [onValidationChange])

  useEffect(() => {
    if (!containerRef.current || editorRef.current || fallbackReason) return
    let disposed = false
    let markersDisposable: Monaco.IDisposable | null = null
    let contentDisposable: Monaco.IDisposable | null = null
    let completionDisposable: Monaco.IDisposable | null = null
    let yamlLanguageDisposable: { dispose: () => void } | null = null
    let runtimeErrorDisposable: { dispose: () => void } | null = null

    const initialize = async () => {
      try {
        registerAutomationMonacoWorkers()
        const monaco = await import('monaco-editor')
        if (disposed || !containerRef.current) return
        monacoRef.current = monaco
        if (!monaco.languages.getLanguages().some(language => language.id === 'yaml')) {
          monaco.languages.register({ id: 'yaml', extensions: ['.yaml', '.yml'], aliases: ['YAML', 'yaml'] })
        }
        monaco.languages.setLanguageConfiguration('yaml', {
          comments: { lineComment: '#' },
          brackets: [
            ['{', '}'],
            ['[', ']']
          ],
          autoClosingPairs: [
            { open: '{', close: '}' },
            { open: '[', close: ']' },
            { open: '"', close: '"' },
            { open: "'", close: "'" }
          ],
          surroundingPairs: [
            { open: '{', close: '}' },
            { open: '[', close: ']' },
            { open: '"', close: '"' },
            { open: "'", close: "'" }
          ],
          onEnterRules: [
            {
              beforeText: /^.*:\s*(?:#.*)?$/,
              action: { indentAction: monaco.languages.IndentAction.Indent }
            }
          ]
        })

        const uri = monaco.Uri.parse(modelUri)
        const existingModel = monaco.editor.getModel(uri)
        const currentValue = valueRef.current
        const model = existingModel ?? monaco.editor.createModel(currentValue, 'yaml', uri)
        if (existingModel && existingModel.getValue() !== currentValue) existingModel.setValue(currentValue)
        modelRef.current = model
        const validateModel = () => {
          monaco.editor.setModelMarkers(
            model,
            automationYamlMarkerOwner,
            validateAutomationYamlModel({
              monaco,
              model,
              commands: resolvedCommands,
              schema: resolvedSchema
            })
          )
        }
        runtimeErrorDisposable = registerAutomationYamlRuntimeFallback(validateModel)
        yamlLanguageDisposable = await configureAutomationYamlLanguage({
          monaco,
          modelUri: model.uri.toString(),
          schema: resolvedSchema
        })
        if (disposed || !containerRef.current) {
          yamlLanguageDisposable?.dispose()
          return
        }

        editorRef.current = monaco.editor.create(containerRef.current, {
          model,
          automaticLayout: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 12,
          tabSize: 2,
          wordWrap: 'on',
          wordBasedSuggestions: 'off',
          theme: monacoTheme
        })
        completionDisposable = monaco.languages.registerCompletionItemProvider(
          'yaml',
          createAutomationYamlCompletionProvider({
            monaco,
            commands: resolvedCommands,
            schema: resolvedSchema
          })
        )
        contentDisposable = model.onDidChangeContent(() => {
          onChangeRef.current(model.getValue())
          validateModel()
        })
        markersDisposable = monaco.editor.onDidChangeMarkers(uris => {
          if (!uris.some(item => item.toString() === model.uri.toString())) return
          const markers = monaco.editor.getModelMarkers({ resource: model.uri })
          const errors = markers.filter(marker => marker.severity === monaco.MarkerSeverity.Error)
          onValidationChangeRef.current?.(
            errors.length === 0,
            errors.map(marker => marker.message)
          )
        })
        validateModel()
        window.setTimeout(() => {
          const markers = monaco.editor.getModelMarkers({ resource: model.uri })
          const errors = markers.filter(marker => marker.severity === monaco.MarkerSeverity.Error)
          onValidationChangeRef.current?.(
            errors.length === 0,
            errors.map(marker => marker.message)
          )
        }, 0)
      } catch (error) {
        setFallbackReason(error instanceof Error ? error.message : 'Monaco failed to load.')
      }
    }

    void initialize()

    return () => {
      disposed = true
      try {
        contentDisposable?.dispose()
        markersDisposable?.dispose()
        completionDisposable?.dispose()
        yamlLanguageDisposable?.dispose()
        runtimeErrorDisposable?.dispose()
        if (modelRef.current) monacoRef.current?.editor.setModelMarkers(modelRef.current, automationYamlMarkerOwner, [])
        editorRef.current?.dispose()
      } catch {
        // Monaco can reject pending worker requests during unmount; disposal is still complete.
      }
      editorRef.current = null
      modelRef.current = null
      monacoRef.current = null
    }
  }, [fallbackReason, modelUri, monacoTheme, resolvedCommands, resolvedSchema])

  useEffect(() => {
    const model = modelRef.current
    if (model && model.getValue() !== value) model.setValue(value)
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
        className={classNames('h-full min-h-[28rem] resize-y font-mono text-xs', className)}
        aria-label={ariaLabel}
        onChange={event => onChange(event.target.value)}
      />
    )
  }

  return (
    <div
      ref={containerRef}
      className={classNames(
        'h-full min-h-[28rem] resize-y overflow-hidden rounded-md border border-border/60',
        className
      )}
      aria-label={`${ariaLabel} editor`}
    />
  )
}

const registerAutomationYamlRuntimeFallback = (onFallback: () => void) => {
  const fallback = (error: unknown) => {
    if (!isAutomationYamlWorkerRequestHandlerError(error)) return false
    disableAutomationYamlLanguage()
    onFallback()
    return true
  }

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    if (fallback(event.reason)) event.preventDefault()
  }
  const onError = (event: ErrorEvent) => {
    if (fallback(event.error)) event.preventDefault()
  }

  window.addEventListener('unhandledrejection', onUnhandledRejection)
  window.addEventListener('error', onError)

  return {
    dispose() {
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
      window.removeEventListener('error', onError)
    }
  }
}
