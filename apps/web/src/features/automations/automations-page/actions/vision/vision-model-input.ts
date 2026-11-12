export const readVisionModelInput = ({ visionProviderId, visionModelId }: Record<string, unknown>) => ({
  ...(typeof visionProviderId === 'string' ? { visionProviderId } : {}),
  ...(typeof visionModelId === 'string' ? { visionModelId } : {})
})
