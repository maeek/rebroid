export const passwordMinimumLengthLimits = { min: 0, max: 128, default: 8 } as const
const { min, max } = passwordMinimumLengthLimits

export const isPasswordMinimumLength = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max

export const passwordMinimumLengthError = `Enter a whole number from ${min} to ${max}.`
