export const observationValues = (data: Record<string, unknown>) =>
  typeof data.width === 'number' && typeof data.height === 'number' ? [`${data.width}x${data.height}`] : []
