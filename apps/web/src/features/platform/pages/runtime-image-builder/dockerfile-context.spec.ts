import { describe, expect, it, jest } from '@jest/globals'
import {
  parseDockerfileContextReferences,
  resolveDockerfileContextReferences,
  uploadResolvedContextReferences,
  type LocalBuildContextFile
} from './dockerfile-context'
import type { ContainerImageBuildContextFile } from '@/server/orchestrator/platform/types'

const uploadedFile = (id: string, contextPath: string): ContainerImageBuildContextFile => ({
  contextPath,
  createdAt: '2026-01-01T00:00:00.000Z',
  id,
  originalName: contextPath.split('/').at(-1) ?? contextPath,
  sha256: 'hash',
  sizeBytes: 12,
  storedPath: `/tmp/${id}`
})

const localFile = (contextPath: string): LocalBuildContextFile => ({
  contextPath,
  file: new File(['content'], contextPath.split('/').at(-1) ?? 'file')
})

describe('parseDockerfileContextReferences', () => {
  it('parses shell COPY and ADD sources with options and line continuations', () => {
    const references = parseDockerfileContextReferences(`
FROM redroid/redroid:14.0.0-latest
COPY --chmod=0644 ./apks/GmsCore.apk /system/priv-app/GmsCore/GmsCore.apk
ADD \\
  permissions/privapp-permissions-microg.xml \\
  extra/config.json \\
  /system/etc/permissions/
`)

    expect(references.map(reference => reference.contextPath)).toEqual([
      'apks/GmsCore.apk',
      'permissions/privapp-permissions-microg.xml',
      'extra/config.json'
    ])
    expect(references.every(reference => reference.state === 'local')).toBe(true)
  })

  it('parses JSON COPY sources', () => {
    const references = parseDockerfileContextReferences('COPY ["apks/GmsCore.apk", "permissions/microg.xml", "/out/"]')

    expect(references.map(reference => reference.contextPath)).toEqual(['apks/GmsCore.apk', 'permissions/microg.xml'])
  })

  it('classifies stage, remote, absolute, traversal, root, and wildcard sources', () => {
    const references = parseDockerfileContextReferences(`
COPY --from=builder /out/app.apk /system/app/app.apk
ADD https://example.test/app.apk /tmp/app.apk
COPY /host/file /tmp/file
COPY ../outside /tmp/outside
COPY . /tmp/root
COPY apks/*.apk /tmp/apks/
VOLUME ["/data"]
`)

    expect(references).toHaveLength(6)
    expect(references.map(reference => reference.state)).toEqual([
      'ignored',
      'ignored',
      'ignored',
      'ignored',
      'unsupported',
      'unsupported'
    ])
  })
})

describe('resolveDockerfileContextReferences', () => {
  it('marks selected, uploadable, missing, unsupported, and ignored references', () => {
    const references = parseDockerfileContextReferences(`
COPY selected.apk /tmp/selected.apk
COPY existing.apk /tmp/existing.apk
COPY local.apk /tmp/local.apk
COPY missing.apk /tmp/missing.apk
COPY apks/*.apk /tmp/apks/
ADD https://example.test/app.apk /tmp/app.apk
`)
    const resolved = resolveDockerfileContextReferences({
      contextFiles: [uploadedFile('selected-id', 'selected.apk'), uploadedFile('existing-id', 'existing.apk')],
      localFiles: [localFile('local.apk')],
      references,
      selectedContextFileIds: new Set(['selected-id'])
    })

    expect(resolved.map(item => item.status)).toEqual([
      'selected',
      'uploadable',
      'uploadable',
      'missing',
      'unsupported',
      'ignored'
    ])
    expect(resolved[1].existingFileIds).toEqual(['existing-id'])
    expect(resolved[2].uploadFiles.map(file => file.contextPath)).toEqual(['local.apk'])
  })

  it('resolves directory references to uploaded and local child files', () => {
    const references = parseDockerfileContextReferences('COPY apks/ /tmp/apks/')
    const resolved = resolveDockerfileContextReferences({
      contextFiles: [uploadedFile('uploaded-id', 'apks/existing.apk')],
      localFiles: [localFile('apks/new.apk'), localFile('other.apk')],
      references,
      selectedContextFileIds: new Set()
    })

    expect(resolved[0].status).toBe('uploadable')
    expect(resolved[0].existingFileIds).toEqual(['uploaded-id'])
    expect(resolved[0].uploadFiles.map(file => file.contextPath)).toEqual(['apks/new.apk'])
  })
})

describe('uploadResolvedContextReferences', () => {
  it('selects existing files and uploads missing local files once', async () => {
    const references = parseDockerfileContextReferences(`
COPY existing.apk /tmp/existing.apk
COPY local.apk /tmp/local.apk
COPY local.apk /tmp/local-copy.apk
`)
    const resolved = resolveDockerfileContextReferences({
      contextFiles: [uploadedFile('existing-id', 'existing.apk')],
      localFiles: [localFile('local.apk')],
      references,
      selectedContextFileIds: new Set()
    })
    const upload = jest.fn<(file: LocalBuildContextFile) => Promise<ContainerImageBuildContextFile>>(file =>
      Promise.resolve(uploadedFile(`uploaded-${file.contextPath}`, file.contextPath))
    )

    const result = await uploadResolvedContextReferences({
      resolvedReferences: resolved,
      selectedContextFileIds: new Set(),
      upload
    })

    expect(upload).toHaveBeenCalledTimes(1)
    expect([...result.selectedIds].sort()).toEqual(['existing-id', 'uploaded-local.apk'].sort())
  })

  it('rejects selections over the build context file limit', async () => {
    const references = parseDockerfileContextReferences('COPY local.apk /tmp/local.apk')
    const resolved = resolveDockerfileContextReferences({
      contextFiles: [],
      localFiles: [localFile('local.apk')],
      references,
      selectedContextFileIds: new Set()
    })

    await expect(
      uploadResolvedContextReferences({
        contextFileLimit: 0,
        resolvedReferences: resolved,
        selectedContextFileIds: new Set(),
        upload: file => Promise.resolve(uploadedFile(`uploaded-${file.contextPath}`, file.contextPath))
      })
    ).rejects.toThrow('at most 0 context files')
  })
})
