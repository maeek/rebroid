import { isRedroidImage } from '@/shared/permissions/permissions'

export const redroidDefaultContainerArgs = [
  'androidboot.redroid_gpu_mode=guest',
  'androidboot.use_memfd=true',
  'ro.secure=0',
  'ro.debuggable=1'
]

export type RedroidDisplayProfileId = 'phone-20-9' | 'phone-16-9' | 'tablet-16-10' | 'tablet-landscape-16-10'

export type RedroidDisplayProfile = {
  id: RedroidDisplayProfileId
  label: string
  description: string
  width: number
  height: number
  dpi: number
  fps: number
}

export const redroidDisplayProfiles: RedroidDisplayProfile[] = [
  {
    id: 'phone-16-9',
    label: 'Phone 16:9',
    description: '1080 x 1920, 420 dpi',
    width: 1080,
    height: 1920,
    dpi: 420,
    fps: 60
  },
  {
    id: 'phone-20-9',
    label: 'Phone 20:9',
    description: '1080 x 2400, 420 dpi',
    width: 1080,
    height: 2400,
    dpi: 420,
    fps: 60
  },
  {
    id: 'tablet-16-10',
    label: 'Tablet 16:10',
    description: '1600 x 2560, 320 dpi',
    width: 1600,
    height: 2560,
    dpi: 320,
    fps: 60
  },
  {
    id: 'tablet-landscape-16-10',
    label: 'Tablet landscape',
    description: '2560 x 1600, 320 dpi',
    width: 2560,
    height: 1600,
    dpi: 320,
    fps: 60
  }
]

export const defaultRedroidDisplayProfileId: RedroidDisplayProfileId = 'phone-16-9'

const splitContainerArgs = (value: string) => value.trim().split(/\s+/).filter(Boolean)

export const applyRedroidDefaultContainerArgs = (image: string, extraArgs = '') => {
  if (!isRedroidImage(image)) {
    return extraArgs.trim()
  }

  const extra = splitContainerArgs(extraArgs)
  const extraKeys = new Set(extra.map(arg => arg.split('=')[0]).filter(Boolean))
  const defaults = redroidDefaultContainerArgs.filter(arg => !extraKeys.has(arg.split('=')[0]))
  return [...defaults, ...extra].join(' ')
}

export const getRedroidDisplayProfile = (id: string) =>
  redroidDisplayProfiles.find(profile => profile.id === id) ??
  redroidDisplayProfiles.find(profile => profile.id === defaultRedroidDisplayProfileId) ??
  redroidDisplayProfiles[0]

export const redroidDisplayArgsForProfile = (id: string) => {
  const profile = getRedroidDisplayProfile(id)

  return [
    `androidboot.redroid_width=${profile.width}`,
    `androidboot.redroid_height=${profile.height}`,
    `androidboot.redroid_dpi=${profile.dpi}`,
    `androidboot.redroid_fps=${profile.fps}`
  ].join(' ')
}

export const applyRedroidDisplayContainerArgs = (image: string, displayProfileId: string, extraArgs = '') => {
  if (!isRedroidImage(image)) {
    return extraArgs.trim()
  }

  return applyRedroidDefaultContainerArgs(image, `${redroidDisplayArgsForProfile(displayProfileId)} ${extraArgs}`)
}

const findArgValue = (containerArgs: string | null | undefined, key: string) => {
  const match = splitContainerArgs(containerArgs ?? '').find(arg => arg.startsWith(`${key}=`))
  return match?.slice(key.length + 1) ?? null
}

const positiveNumberArg = (containerArgs: string | null | undefined, key: string) => {
  const parsed = Number(findArgValue(containerArgs, key))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export const getRedroidDisplayDimensionsFromArgs = (containerArgs: string | null | undefined) => {
  const width = positiveNumberArg(containerArgs, 'androidboot.redroid_width') ?? 1080
  const height = positiveNumberArg(containerArgs, 'androidboot.redroid_height') ?? 1920

  return { width, height, aspectRatio: width / height }
}

export const redroidDefaultsLabel = redroidDefaultContainerArgs.join(' ')
