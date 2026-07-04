export const normalizeBuildContextPath = (value: string) => {
  const raw = value.trim().replace(/\\/g, '/')
  if (!raw || raw.startsWith('/')) {
    return null
  }

  const withoutLeadingCurrent = raw.replace(/^\.\/+/, '')
  const segments: string[] = []
  for (const segment of withoutLeadingCurrent.split('/')) {
    if (!segment || segment === '.') {
      continue
    }
    if (segment === '..') {
      return null
    }
    segments.push(segment)
  }

  return segments.join('/')
}
