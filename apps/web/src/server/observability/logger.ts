import 'server-only'

type LogLevel = 'info' | 'warn' | 'error'
type LogFields = Record<string, unknown>

const sensitiveKey = /(authorization|cookie|password|secret|token)/i

const redact = (fields: LogFields) =>
  Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, sensitiveKey.test(key) ? '[redacted]' : value]))

const writeLog = (level: LogLevel, event: string, fields: LogFields = {}) => {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...redact(fields)
  })
  if (level === 'error') {
    console.error(entry)
    return
  }
  if (level === 'warn') {
    console.warn(entry)
    return
  }
  process.stdout.write(`${entry}\n`)
}

export const logger = {
  info: (event: string, fields?: LogFields) => writeLog('info', event, fields),
  warn: (event: string, fields?: LogFields) => writeLog('warn', event, fields),
  error: (event: string, fields?: LogFields) => writeLog('error', event, fields)
}
