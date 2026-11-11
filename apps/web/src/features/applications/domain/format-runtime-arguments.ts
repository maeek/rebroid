import { parseCommandLine } from '@rebroid/android-application-core/redroid-runtime'

const quoteShellArgument = (value: string) => {
  if (/^[a-zA-Z0-9_@%+=:,./-]+$/.test(value)) return value
  return `'${value.replaceAll("'", "'\"'\"'")}'`
}

export const formatRuntimeCommand = (args: string[]) => args.map(quoteShellArgument).join(' \\\n')

export const formatRuntimeArguments = (value: string) => formatRuntimeCommand(parseCommandLine(value) ?? [])
