export const registerAutomationMonacoWorkers = () => {
  if (globalThis.MonacoEnvironment?.getWorker || globalThis.MonacoEnvironment?.getWorkerUrl) return

  globalThis.MonacoEnvironment = {
    ...globalThis.MonacoEnvironment,
    getWorker: () =>
      new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker', import.meta.url), { type: 'module' })
  }
}
