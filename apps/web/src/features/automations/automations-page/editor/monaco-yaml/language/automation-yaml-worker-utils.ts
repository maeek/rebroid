type MonacoWorkerEnvironment = NonNullable<typeof globalThis.MonacoEnvironment>

export const automationYamlWorkerOptions = { type: 'module' } as const satisfies WorkerOptions

export const shouldUseAutomationYamlWorker = (moduleId: string, label: string) =>
  label === 'yaml' || moduleId === 'monaco-yaml/yaml.worker'

export const createAutomationMonacoWorkerEnvironment = ({
  existingEnvironment,
  createYamlWorker,
  createEditorWorker
}: {
  existingEnvironment?: MonacoWorkerEnvironment
  createYamlWorker: () => Worker
  createEditorWorker: () => Worker
}): MonacoWorkerEnvironment => ({
  ...existingEnvironment,
  getWorker(moduleId, label) {
    if (shouldUseAutomationYamlWorker(moduleId, label)) return createYamlWorker()

    const worker = existingEnvironment?.getWorker?.(moduleId, label)
    if (worker) return worker

    return createEditorWorker()
  }
})
