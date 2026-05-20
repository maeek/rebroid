import { isRedroidImage } from '@/shared/permissions/permissions'

export const redroidDefaultContainerArgs = [
  'androidboot.redroid_gpu_mode=guest',
  'androidboot.use_memfd=true',
  'ro.secure=0',
  'ro.debuggable=1'
]

const splitContainerArgs = (value: string) => value.trim().split(/\s+/).filter(Boolean)

export const applyRedroidDefaultContainerArgs = (image: string, extraArgs: string) => {
  if (!isRedroidImage(image)) {
    return extraArgs.trim()
  }

  const extra = splitContainerArgs(extraArgs)
  const extraKeys = new Set(extra.map(arg => arg.split('=')[0]).filter(Boolean))
  const defaults = redroidDefaultContainerArgs.filter(arg => !extraKeys.has(arg.split('=')[0]))
  return [...defaults, ...extra].join(' ')
}

export const redroidDefaultsLabel = redroidDefaultContainerArgs.join(' ')
