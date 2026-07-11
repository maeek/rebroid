import { describe, expect, it, vi } from 'vitest'
import {
  automationYamlWorkerOptions,
  createAutomationMonacoWorkerEnvironment,
  shouldUseAutomationYamlWorker
} from './automation-yaml-worker-utils'

describe('automation YAML Monaco workers', () => {
  it('routes yaml labels and module ids to the YAML worker', () => {
    expect(shouldUseAutomationYamlWorker('workerMain.js', 'yaml')).toBe(true)
    expect(shouldUseAutomationYamlWorker('monaco-yaml/yaml.worker', 'editorWorkerService')).toBe(true)
    expect(shouldUseAutomationYamlWorker('workerMain.js', 'editorWorkerService')).toBe(false)
  })

  it('uses module worker options for YAML workers', () => {
    expect(automationYamlWorkerOptions).toEqual({ type: 'module' })
  })

  it('delegates non-yaml workers to an existing environment before using the editor fallback', () => {
    const yamlWorker = {} as Worker
    const existingWorker = {} as Worker
    const editorWorker = {} as Worker
    const environment = createAutomationMonacoWorkerEnvironment({
      existingEnvironment: {
        getWorker: vi.fn(() => existingWorker)
      },
      createYamlWorker: vi.fn(() => yamlWorker),
      createEditorWorker: vi.fn(() => editorWorker)
    })

    expect(environment.getWorker?.('workerMain.js', 'yaml')).toBe(yamlWorker)
    expect(environment.getWorker?.('workerMain.js', 'json')).toBe(existingWorker)
  })
})
