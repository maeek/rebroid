const byteUnits = ['B', 'KB', 'MB', 'GB', 'TB'] as const

export const formatBytes = (bytes: number) => {
  if (bytes === 0) {
    return '0 B'
  }

  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), byteUnits.length - 1)
  return `${(bytes / 1024 ** unitIndex).toFixed(2)} ${byteUnits[unitIndex]}`
}
