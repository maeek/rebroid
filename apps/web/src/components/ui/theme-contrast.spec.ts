import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from '@jest/globals'

type HslTuple = [number, number, number]
type RgbTuple = [number, number, number]

const globalsCss = readFileSync(join(__dirname, '../../app/globals.css'), 'utf8')

const parseRawScope = (selector: string) => {
  const blockPattern = /([^{}]+)\{([^{}]*?)\}/g
  const matchingBlocks = [...globalsCss.matchAll(blockPattern)].filter(block =>
    block[1]
      .split(',')
      .map(value => value.trim())
      .includes(selector)
  )

  if (matchingBlocks.length === 0) {
    throw new Error(`Missing ${selector} theme scope`)
  }

  const rawTokens = new Map<string, string>()
  for (const block of matchingBlocks) {
    const declarationPattern = /--([a-z0-9-]+):\s*([^;]+);/g
    for (const declaration of block[2].matchAll(declarationPattern)) {
      rawTokens.set(declaration[1], declaration[2].trim())
    }
  }

  return rawTokens
}

const parseScope = (...selectors: string[]) => {
  const rawTokens = new Map<string, string>()
  for (const selector of selectors) {
    for (const [token, value] of parseRawScope(selector)) {
      rawTokens.set(token, value)
    }
  }

  const resolveToken = (token: string, seen = new Set<string>()): HslTuple => {
    const value = rawTokens.get(token)
    if (!value) {
      throw new Error(`Missing theme token --${token}`)
    }

    const tupleMatch = value.match(/^([0-9.]+)\s+([0-9.]+)%\s+([0-9.]+)%$/)
    if (tupleMatch) {
      return [Number(tupleMatch[1]), Number(tupleMatch[2]), Number(tupleMatch[3])]
    }

    const aliasMatch = value.match(/^var\(--([a-z0-9-]+)\)$/)
    if (aliasMatch) {
      if (seen.has(aliasMatch[1])) {
        throw new Error(`Circular theme token reference --${token}`)
      }
      seen.add(aliasMatch[1])
      return resolveToken(aliasMatch[1], seen)
    }

    throw new Error(`Unsupported theme token value --${token}: ${value}`)
  }

  const tokens = new Map<string, HslTuple>()
  for (const token of rawTokens.keys()) {
    try {
      tokens.set(token, resolveToken(token))
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Unsupported theme token value')) {
        continue
      }
      throw error
    }
  }

  return tokens
}

const hslToRgb = ([h, s, l]: HslTuple): RgbTuple => {
  const saturation = s / 100
  const lightness = l / 100
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lightness - chroma / 2
  let r = 0
  let g = 0
  let b = 0

  if (h < 60) {
    r = chroma
    g = x
  } else if (h < 120) {
    r = x
    g = chroma
  } else if (h < 180) {
    g = chroma
    b = x
  } else if (h < 240) {
    g = x
    b = chroma
  } else if (h < 300) {
    r = x
    b = chroma
  } else {
    r = chroma
    b = x
  }

  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

const relativeLuminance = (rgb: RgbTuple) =>
  rgb
    .map(channel => {
      const value = channel / 255
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)

const contrastRatio = (foreground: HslTuple, background: HslTuple) => {
  const foregroundLuminance = relativeLuminance(hslToRgb(foreground))
  const backgroundLuminance = relativeLuminance(hslToRgb(background))
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)

  return (lighter + 0.05) / (darker + 0.05)
}

const contrastRatioRgb = (foreground: HslTuple, background: RgbTuple) => {
  const foregroundLuminance = relativeLuminance(hslToRgb(foreground))
  const backgroundLuminance = relativeLuminance(background)
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)

  return (lighter + 0.05) / (darker + 0.05)
}

const blendHslOverHsl = (foreground: HslTuple, background: HslTuple, alpha: number): RgbTuple => {
  const foregroundRgb = hslToRgb(foreground)
  const backgroundRgb = hslToRgb(background)

  return foregroundRgb.map((value, index) => Math.round(value * alpha + backgroundRgb[index] * (1 - alpha))) as RgbTuple
}

const requireToken = (tokens: Map<string, HslTuple>, token: string) => {
  const value = tokens.get(token)
  if (!value) {
    throw new Error(`Missing theme token --${token}`)
  }
  return value
}

describe('theme contrast tokens', () => {
  const themeModes = [
    ['light', parseScope('.light')],
    ['dark', parseScope('.dark')],
    ['oled', parseScope('.oled')]
  ] as const

  const themeSelectors = [
    ['light', '.light'],
    ['dark', '.dark'],
    ['oled', '.oled']
  ] as const

  const accentColorIds = ['cyan', 'green', 'purple', 'pink', 'red', 'amber'] as const

  const accentThemeModes: Array<[string, Map<string, HslTuple>]> = themeSelectors.flatMap(([mode, selector]) =>
    accentColorIds.map(
      accentColor =>
        [`${mode} ${accentColor}`, parseScope(selector, `${selector}[data-accent='${accentColor}']`)] as [
          string,
          Map<string, HslTuple>
        ]
    )
  )

  const textPairs = [
    ['foreground', 'background'],
    ['foreground-muted', 'background'],
    ['foreground-subtle', 'background'],
    ['foreground', 'surface'],
    ['foreground', 'surface-panel'],
    ['foreground', 'surface-band'],
    ['foreground', 'surface-elevated'],
    ['card-foreground', 'card'],
    ['popover-foreground', 'popover'],
    ['primary-foreground', 'primary'],
    ['secondary-foreground', 'secondary'],
    ['accent-foreground', 'accent'],
    ['destructive-foreground', 'destructive'],
    ['success-foreground', 'success'],
    ['warning-foreground', 'warning']
  ] as const

  const boundaryPairs = [
    ['control-border-strong', 'control'],
    ['ring', 'background']
  ] as const

  const idleBoundaryPairs = [['control-border', 'control']] as const

  it.each(themeModes)('%s text pairs meet 4.5:1', (_mode, tokens) => {
    for (const [foreground, background] of textPairs) {
      expect(contrastRatio(requireToken(tokens, foreground), requireToken(tokens, background))).toBeGreaterThanOrEqual(
        4.5
      )
    }
  })

  it.each(themeModes)('%s control boundaries meet 3:1', (_mode, tokens) => {
    for (const [foreground, background] of boundaryPairs) {
      expect(contrastRatio(requireToken(tokens, foreground), requireToken(tokens, background))).toBeGreaterThanOrEqual(
        3
      )
    }
  })

  it.each(themeModes)('%s idle control borders remain intentionally muted', (_mode, tokens) => {
    for (const [foreground, background] of idleBoundaryPairs) {
      const ratio = contrastRatio(requireToken(tokens, foreground), requireToken(tokens, background))
      expect(ratio).toBeGreaterThanOrEqual(1.25)
      expect(ratio).toBeLessThan(3)
    }
  })

  it.each(themeModes)('%s unchecked switches keep a visible thumb boundary', (_mode, tokens) => {
    expect(
      contrastRatio(requireToken(tokens, 'control-border-strong'), requireToken(tokens, 'control'))
    ).toBeGreaterThanOrEqual(3)
  })

  it.each(accentThemeModes)('%s accent text pairs meet 4.5:1', (_label, tokens) => {
    for (const [foreground, background] of textPairs) {
      expect(contrastRatio(requireToken(tokens, foreground), requireToken(tokens, background))).toBeGreaterThanOrEqual(
        4.5
      )
    }

    const activeAccentBackground = blendHslOverHsl(
      requireToken(tokens, 'accent'),
      requireToken(tokens, 'background'),
      0.7
    )
    expect(contrastRatioRgb(requireToken(tokens, 'accent-foreground'), activeAccentBackground)).toBeGreaterThanOrEqual(
      4.5
    )
  })
})
