const applicationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isApplicationId = (value: unknown): value is string =>
  typeof value === 'string' && applicationIdPattern.test(value)
