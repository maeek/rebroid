import type { ContainerImageBuildRecipe } from '@/server/orchestrator/platform/types'
import type {
  RuntimeImageGmsMode,
  RuntimeImageKind,
  RuntimeImageSignatureSpoofing
} from '@rebroid/application-core/redroid-runtime'

export type BuilderValues = {
  name: string
  targetImage: string
  baseImage: string
  runtimeKind: RuntimeImageKind
  androidVersion: string
  architecture: string
  gmsMode: RuntimeImageGmsMode
  signatureSpoofing: RuntimeImageSignatureSpoofing
  dockerfile: string
}

export const templateDockerfile = (baseImage: string) => `FROM ${baseImage}

# microG overlay expects a base image whose Android framework already supports signature spoofing.
USER root
COPY apks/GmsCore.apk /system/priv-app/GmsCore/GmsCore.apk
COPY permissions/privapp-permissions-microg.xml /system/etc/permissions/privapp-permissions-microg.xml
RUN chmod 0644 /system/priv-app/GmsCore/GmsCore.apk \\
    /system/etc/permissions/privapp-permissions-microg.xml
`

export const defaultBuilderValues: BuilderValues = {
  name: 'Redroid 14 microG overlay',
  targetImage: 'local/redroid-microg:14',
  baseImage: 'redroid/redroid:14.0.0-latest',
  runtimeKind: 'redroid',
  androidVersion: '14',
  architecture: 'amd64',
  gmsMode: 'microg',
  signatureSpoofing: 'external_required',
  dockerfile: templateDockerfile('redroid/redroid:14.0.0-latest')
}

export const contextIdsFromRecipe = (recipe: ContainerImageBuildRecipe) => {
  try {
    const parsed = JSON.parse(recipe.contextFileIdsJson) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export const recipeToValues = (recipe: ContainerImageBuildRecipe): BuilderValues => ({
  name: recipe.name,
  targetImage: recipe.targetImage,
  baseImage: recipe.baseImage,
  runtimeKind: recipe.runtimeKind,
  androidVersion: recipe.androidVersion ?? '',
  architecture: recipe.architecture ?? '',
  gmsMode: recipe.gmsMode,
  signatureSpoofing: recipe.signatureSpoofing,
  dockerfile: recipe.dockerfile
})
