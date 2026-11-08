import { describe, expect, it } from 'vitest'
import { buildValidation } from './build-validation'
import { defaultBuilderValues } from './builder-values'
import { parseDockerfileContextReferences } from './dockerfile-context-parser'
import { resolveDockerfileContextReferences } from './dockerfile-context-resolver'
import type { LocalBuildContextFile } from './dockerfile-context-types'

const validate = (localFiles: LocalBuildContextFile[] = []) =>
  buildValidation(
    defaultBuilderValues,
    [],
    resolveDockerfileContextReferences({
      contextFiles: [],
      localFiles,
      references: parseDockerfileContextReferences(defaultBuilderValues.dockerfile),
      selectedContextFileIds: new Set()
    })
  )

describe('build validation', () => {
  it('reports each missing path once while preserving the build block', () => {
    const result = validate()
    expect(result.errors).toEqual([
      'Missing build context files: apks/GmsCore.apk, permissions/privapp-permissions-microg.xml.'
    ])
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('Signature spoofing')
  })
  it('accepts files that can be uploaded automatically before the build', () => {
    const files = ['apks/GmsCore.apk', 'permissions/privapp-permissions-microg.xml'].map(contextPath => ({
      contextPath,
      file: new File(['data'], contextPath.split('/').at(-1)!)
    }))
    expect(validate(files).errors).toEqual([])
  })
  it('continues to require the image and a Dockerfile FROM instruction', () => {
    const result = buildValidation(
      { ...defaultBuilderValues, gmsMode: 'none', targetImage: ' ', baseImage: '', dockerfile: '' },
      [],
      []
    )
    expect(result.errors).toEqual([
      'Target image is required.',
      'Base image is required.',
      'Dockerfile needs a FROM instruction.'
    ])
  })
})
