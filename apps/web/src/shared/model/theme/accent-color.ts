export const accentColorChangeEvent = 'rebroid-accent-color-change'

export const accentColorPresets = [
  { id: 'blue', label: 'Blue', swatch: '206 100% 48%' },
  { id: 'cyan', label: 'Cyan', swatch: '190 95% 46%' },
  { id: 'green', label: 'Green', swatch: '154 68% 42%' },
  { id: 'purple', label: 'Purple', swatch: '262 76% 58%' },
  { id: 'pink', label: 'Pink', swatch: '330 78% 56%' },
  { id: 'red', label: 'Red', swatch: '0 74% 54%' },
  { id: 'amber', label: 'Amber', swatch: '34 94% 50%' }
] as const

export type AccentColor = (typeof accentColorPresets)[number]['id']

export const defaultAccentColor: AccentColor = 'blue'

const accentColorIds = new Set<string>(accentColorPresets.map(preset => preset.id))

export const isAccentColor = (value: string | null | undefined): value is AccentColor =>
  typeof value === 'string' && accentColorIds.has(value)

export const getAccentColorDataAttribute = (accentColor: string | null | undefined) =>
  isAccentColor(accentColor) && accentColor !== defaultAccentColor ? accentColor : undefined
