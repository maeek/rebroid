'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'

export type FieldPath = string | readonly (string | number)[]
const FieldChangesContext = createContext<{ value: object; baseline: object } | null>(null)

export const fieldValuesEqual = (value: unknown, baseline: unknown): boolean => {
  if (Object.is(value, baseline) || (value == null && baseline == null)) return true
  if (!value || !baseline || typeof value !== 'object' || typeof baseline !== 'object') return false
  if (Array.isArray(value) || Array.isArray(baseline)) {
    return (
      Array.isArray(value) &&
      Array.isArray(baseline) &&
      value.length === baseline.length &&
      value.every((item, index) => fieldValuesEqual(item, baseline[index]))
    )
  }
  const current = value as Record<string, unknown>
  const saved = baseline as Record<string, unknown>
  return [...new Set([...Object.keys(current), ...Object.keys(saved)])].every(key =>
    fieldValuesEqual(current[key], saved[key])
  )
}

const fieldValue = (source: object, path: FieldPath): unknown => {
  let value: unknown = source
  for (const key of typeof path === 'string' ? [path] : path) {
    if (!value || typeof value !== 'object') return undefined
    value = (value as Record<string | number, unknown>)[key]
  }
  return value
}

/** The owner supplies its acknowledged baseline; this provider never captures edits as saved. */
export const FieldChangesProvider = ({
  value,
  baseline,
  children
}: {
  value?: object | null
  baseline?: object | null
  children: ReactNode
}) => {
  const context = useMemo(() => (value && baseline ? { value, baseline } : null), [value, baseline])
  return <FieldChangesContext.Provider value={context}>{children}</FieldChangesContext.Provider>
}

export const useFieldModified = (field?: FieldPath) => {
  const context = useContext(FieldChangesContext)
  if (!context || field === undefined) return undefined
  return !fieldValuesEqual(fieldValue(context.value, field), fieldValue(context.baseline, field))
}
