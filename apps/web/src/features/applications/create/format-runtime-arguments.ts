import { parseCommandLine } from '@rebroid/android-application-core/redroid-runtime'

const quoteShellArgument = (value: string) => {
  if (/^[a-zA-Z0-9_@%+=:,./-]+$/.test(value)) return value
  return `'${value.replaceAll("'", "'\"'\"'")}'`
}

export const formatRuntimeArguments = (value: string) =>
  (parseCommandLine(value) ?? []).map(quoteShellArgument).join(' \\\n')
