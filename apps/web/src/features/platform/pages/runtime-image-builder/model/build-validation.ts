import type { BuilderValues } from './builder-values'
import type { ResolvedContextReference } from './dockerfile-context-types'
import type { ContainerImageBuildContextFile } from '@/shared/contracts/platform'

export type BuildValidation = {
  errors: string[]
  warnings: string[]
}

const requiredMicrogContextPaths = ['apks/GmsCore.apk', 'permissions/privapp-permissions-microg.xml']

export const buildValidation = (
  values: BuilderValues,
  contextFiles: ContainerImageBuildContextFile[],
  resolvedContextReferences: ResolvedContextReference[]
): BuildValidation => {
  const errors: string[] = []
  const warnings: string[] = []
  if (!values.targetImage.trim()) errors.push('Target image is required.')
  if (!values.baseImage.trim()) errors.push('Base image is required.')
  if (!/^\s*FROM\s+\S+/im.test(values.dockerfile)) errors.push('Dockerfile needs a FROM instruction.')

  const contextPaths = new Set(contextFiles.map(file => file.contextPath))
  for (const reference of resolvedContextReferences) {
    if (reference.status === 'selected' || reference.status === 'uploadable') {
      if (reference.contextPath) {
        contextPaths.add(reference.contextPath)
      }
      reference.uploadFiles.forEach(file => contextPaths.add(file.contextPath))
    }
  }
  const missingMicrogFiles = requiredMicrogContextPaths.filter(path => !contextPaths.has(path))
  if (values.gmsMode === 'microg' && missingMicrogFiles.length > 0) {
    errors.push(`Missing microG context files: ${missingMicrogFiles.join(', ')}.`)
  }
  const missingReferences = resolvedContextReferences.filter(reference => reference.status === 'missing')
  if (missingReferences.length > 0) {
    errors.push(
      `Missing Dockerfile context files: ${missingReferences.map(reference => reference.reference.source).join(', ')}.`
    )
  }
  const unsupportedReferences = resolvedContextReferences.filter(reference => reference.status === 'unsupported')
  if (unsupportedReferences.length > 0) {
    warnings.push(
      `Unsupported Dockerfile context sources: ${unsupportedReferences.map(reference => reference.reference.source).join(', ')}.`
    )
  }
  const directoryUploadCount = resolvedContextReferences
    .filter(reference => reference.status === 'uploadable' && reference.uploadFiles.length > 1)
    .reduce((count, reference) => count + reference.uploadFiles.length, 0)
  if (directoryUploadCount > 0) {
    warnings.push(`Directory references will upload ${directoryUploadCount} local files.`)
  }
  if (values.runtimeKind === 'redroid' && values.signatureSpoofing === 'external_required') {
    warnings.push('Signature spoofing must already be present in the base image; Dockerfile layering cannot patch it.')
  }
  if (/FROM\s+redroid\/redroid:/i.test(values.dockerfile) && values.gmsMode === 'microg') {
    warnings.push('Stock Redroid bases are marked as requiring external signature spoofing.')
  }

  return { errors, warnings }
}
