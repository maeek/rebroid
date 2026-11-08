export const dockerOperationLimitFields = [
  {
    key: 'maxConcurrentReads',
    label: 'Concurrent reads',
    description: 'Maximum Docker read operations in flight.',
    unit: 'reads',
    min: 1,
    max: 64
  },
  {
    key: 'maxConcurrentLongOperations',
    label: 'Concurrent long operations',
    description: 'Maximum concurrent builds, pulls, and archive operations.',
    unit: 'operations',
    min: 1,
    max: 16
  },
  {
    key: 'slowRequestWarningMs',
    label: 'Slow-operation warning',
    description: 'Record a warning when an operation exceeds this duration.',
    unit: 'ms',
    min: 100,
    max: 300_000
  },
  {
    key: 'longOperationTimeoutMs',
    label: 'Long-operation timeout',
    description: 'Deadline used by new long operations unless they set a specific timeout.',
    unit: 'ms',
    min: 1000,
    max: 3_600_000
  }
] as const

export const formatOperationLimitDuration = (milliseconds: number) => {
  if (milliseconds % 60_000 === 0) {
    const minutes = milliseconds / 60_000
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
  }
  if (milliseconds % 1000 === 0) {
    const seconds = milliseconds / 1000
    return `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`
  }
  return `${milliseconds.toLocaleString()} ms`
}
