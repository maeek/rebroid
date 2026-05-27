const isValidDate = (date: Date) => !Number.isNaN(date.getTime())

const toDate = (value: Date | string | number) => (value instanceof Date ? value : new Date(value))

const pad = (value: number) => value.toString().padStart(2, '0')

export const formatUtcDate = (value: Date | string | number, fallback = 'unknown') => {
  const date = toDate(value)
  if (!isValidDate(date)) {
    return fallback
  }

  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

export const formatUtcTime = (value: Date | string | number, fallback = 'unknown') => {
  const date = toDate(value)
  if (!isValidDate(date)) {
    return fallback
  }

  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
}

export const formatUtcDateTime = (value: Date | string | number, fallback = 'unknown') => {
  const date = toDate(value)
  if (!isValidDate(date)) {
    return fallback
  }

  return `${formatUtcDate(date, fallback)} ${formatUtcTime(date, fallback)} UTC`
}

export const formatDisplayNumber = (value: number) => new Intl.NumberFormat('en-US').format(value)
