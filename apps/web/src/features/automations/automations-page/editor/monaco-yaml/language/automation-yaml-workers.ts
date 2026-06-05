import { automationYamlWorkerOptions, createAutomationMonacoWorkerEnvironment } from './automation-yaml-worker-utils'

let registered = false

export const registerAutomationMonacoWorkers = () => {
  if (registered) return
  registered = true

  globalThis.MonacoEnvironment = createAutomationMonacoWorkerEnvironment({
    existingEnvironment: globalThis.MonacoEnvironment,
    createYamlWorker: () => new Worker(new URL('monaco-yaml/yaml.worker', import.meta.url), automationYamlWorkerOptions),
    createEditorWorker: () =>
      new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker', import.meta.url), automationYamlWorkerOptions)
  })
}
