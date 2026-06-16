const shortPerceptionStatus = (status: string) => {
  if (status === 'available') return 'ok'
  return status
}

export const perceptionSummary = (data: Record<string, unknown>) => {
  const parts: string[] = []
  const uiStatus = typeof data.uiStatus === 'string' ? data.uiStatus : ''
  const ocrStatus = typeof data.ocrStatus === 'string' ? data.ocrStatus : ''
  const screenKind = typeof data.screenKind === 'string' ? data.screenKind : ''

  if (uiStatus && uiStatus !== 'unavailable') parts.push(`UI ${shortPerceptionStatus(uiStatus)}`)
  if (ocrStatus && ocrStatus !== 'unavailable' && ocrStatus !== 'disabled') {
    parts.push(`OCR ${shortPerceptionStatus(ocrStatus)}`)
  }
  if (screenKind) parts.push(`vision: ${screenKind}`)

  return parts.length > 0 ? parts.join(' · ') : ''
}
