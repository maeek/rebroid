export const numberInputValue = (input: Record<string, unknown>, key: string, fallback = 0) =>
  typeof input[key] === 'number' ? input[key] : fallback

export const stringInputValue = (input: Record<string, unknown>, key: string, fallback = '') =>
  typeof input[key] === 'string' ? input[key] : fallback

export const booleanInputValue = (input: Record<string, unknown>, key: string, fallback = false) =>
  typeof input[key] === 'boolean' ? input[key] : fallback

export const normalizeNumberInput = (input: Record<string, unknown>, key: string, fallback: number) => ({
  [key]: numberInputValue(input, key, fallback)
})

export const normalizeStringInput = (input: Record<string, unknown>, key: string, fallback = '') => ({
  [key]: stringInputValue(input, key, fallback)
})

export const normalizeBooleanInput = (input: Record<string, unknown>, key: string, fallback = false) => ({
  [key]: booleanInputValue(input, key, fallback)
})
