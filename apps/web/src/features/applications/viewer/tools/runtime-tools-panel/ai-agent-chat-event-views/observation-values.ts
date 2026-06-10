export const observationValues = (
  data: Record<string, unknown>,
  options: { dimensions?: boolean; nodeCount?: boolean; detections?: boolean; bytes?: boolean } = {}
) => {
  const parts: string[] = []
  const dimensions =
    typeof data.width === 'number' && typeof data.height === 'number' && options.dimensions
      ? `${data.width}x${data.height}`
      : ''
  const bytes = options.bytes && typeof data.bytes === 'number' ? `${Math.round(data.bytes / 1024)} KB` : ''
  const nodeCount = typeof data.nodeCount === 'number' ? `${data.nodeCount} nodes` : ''
  const detections = typeof data.detections === 'number' ? `${data.detections} detected` : ''

  if (dimensions) {
    parts.push(dimensions)
  }
  if (options.nodeCount && nodeCount) {
    parts.push(nodeCount)
  }
  if (options.detections && detections) {
    parts.push(detections)
  }
  if (bytes) {
    parts.push(bytes)
  }
  return parts
}
