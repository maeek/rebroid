import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '../../../../lib/error-utils'

export const formatBytes = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`
}

export const downloadDataUrl = (dataUrl: string, fileName: string) => {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export const runtimeActionErrorToast = (title: string, error: unknown) => {
  toast({
    title,
    description: getDisplayErrorMessage(error),
    variant: 'destructive'
  })
}
