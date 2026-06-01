export const getHslColorFromCharCode = (text: string, saturation = '100%', lightness = '85%', opacity = 1) => {
  // 360 / 25 - degrees divided by number of the characters in the alphabet
  const MULTIPLIER = 14.4
  // Letter "a" in ascii table
  const STARTING_CHAR = 97

  const charCode = text.toLocaleLowerCase().charCodeAt(0)
  return `hsla(${Math.abs(charCode - STARTING_CHAR) * MULTIPLIER}deg,${saturation},${lightness},${opacity})`
}

export const getHslColorFromCharCodeForeground = (text: string) => {
  return getHslColorFromCharCode(text, '100%', '25%')
}
