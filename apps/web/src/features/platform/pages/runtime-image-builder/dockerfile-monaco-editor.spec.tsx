import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DockerfileMonacoEditor } from './dockerfile-monaco-editor'

const mocks = vi.hoisted(() => {
  const model = {
    getValue: vi.fn(() => 'FROM image:14'),
    setValue: vi.fn(),
    onDidChangeContent: vi.fn(() => ({ dispose: vi.fn() })),
    dispose: vi.fn()
  }
  const instance = { dispose: vi.fn(), updateOptions: vi.fn() }
  return {
    theme: 'dark',
    model,
    instance,
    create: vi.fn(() => instance),
    createModel: vi.fn(() => model),
    setTheme: vi.fn()
  }
})
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: mocks.theme }) }))
vi.mock('monaco-editor', () => ({
  languages: { getLanguages: () => [{ id: 'dockerfile' }] },
  Uri: { parse: (uri: string) => uri },
  editor: {
    defineTheme: vi.fn(),
    getModel: () => null,
    create: mocks.create,
    createModel: mocks.createModel,
    setTheme: mocks.setTheme
  }
}))
describe('DockerfileMonacoEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.theme = 'dark'
  })
  it('preserves the editor and undo model when changing theme or disabling edits', async () => {
    const onChange = vi.fn()
    const { rerender, unmount } = render(
      <DockerfileMonacoEditor
        value='FROM image:14'
        onChange={onChange}
      />
    )
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce())
    mocks.theme = 'light'
    rerender(
      <DockerfileMonacoEditor
        value='FROM image:14'
        onChange={onChange}
        disabled
      />
    )
    expect(mocks.setTheme).toHaveBeenLastCalledWith('rebroid-dockerfile-light')
    expect(mocks.instance.updateOptions).toHaveBeenLastCalledWith({ readOnly: true })
    expect(mocks.create).toHaveBeenCalledOnce()
    expect(mocks.model.dispose).not.toHaveBeenCalled()
    unmount()
    expect(mocks.model.dispose).toHaveBeenCalledOnce()
    expect(mocks.instance.dispose).toHaveBeenCalledOnce()
  })
  it('synchronizes a replacement template without recreating the editor', async () => {
    const { rerender } = render(
      <DockerfileMonacoEditor
        value='FROM image:14'
        onChange={vi.fn()}
      />
    )
    await waitFor(() => expect(mocks.createModel).toHaveBeenCalledOnce())
    rerender(
      <DockerfileMonacoEditor
        value='FROM image:13'
        onChange={vi.fn()}
      />
    )
    expect(mocks.model.setValue).toHaveBeenCalledWith('FROM image:13')
    expect(mocks.create).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('Dockerfile editor')).toBeVisible()
  })
})
