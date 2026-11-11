import { formatDateLocale } from '@/lib/format'

export const formatPlatformDate = (value: string | null | undefined) => {
  if (!value) {
    return 'unknown'
  }

  return formatDateLocale(value)
}

export const formatPlatformBytes = (bytes: number) => {
  if (!bytes) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(2)} ${units[index]}`
}
