export const referenceDisplay = {
  width: 1080,
  height: 1920
}

export const pixelToPercent = (value: number, axis: 'x' | 'y') => {
  const size = axis === 'x' ? referenceDisplay.width : referenceDisplay.height
  return Math.round((value / size) * 100)
}

export const percentToPixel = (value: number, axis: 'x' | 'y') => {
  const size = axis === 'x' ? referenceDisplay.width : referenceDisplay.height
  return Math.round((value / 100) * size)
}
