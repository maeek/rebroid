export const registerAutomationMonacoWorkers = () => {
  if (globalThis.MonacoEnvironment?.getWorker || globalThis.MonacoEnvironment?.getWorkerUrl) return

  globalThis.MonacoEnvironment = {
    ...globalThis.MonacoEnvironment,
    getWorker: () =>
      new Worker(new URL('monaco-editor/editor/editor.worker.js', import.meta.url), { type: 'module' })
  }
}
