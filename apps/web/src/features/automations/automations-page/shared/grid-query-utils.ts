export const allFilterValue = 'all'

export const compactGridParams = (values: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    const text = String(value ?? '').trim()
    if (text && text !== allFilterValue) params.set(key, text)
  }
  return params
}
