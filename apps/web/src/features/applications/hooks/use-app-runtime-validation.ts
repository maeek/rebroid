import { useCallback, useLayoutEffect, useState, type FormEvent, type RefObject } from 'react'
import {
  appRuntimeFields,
  type AppRuntimeFieldErrors,
  type AppRuntimeFields,
  type AppRuntimeSettingsDraft
} from '../model/app-runtime-settings'
import type { ResourceLimitBounds } from '@/shared/contracts/system-resources'

const getNumberInputError = (input: HTMLInputElement) => {
  if (input.validity.badInput) return 'Enter a number.'
  if (input.validity.valueMissing) return 'Enter a value.'
  if (input.validity.rangeOverflow) return `Enter a value of ${input.max} or less.`
  if (input.validity.rangeUnderflow) return `Enter a value of ${input.min} or more.`
  if (input.validity.stepMismatch) return `Enter a value in increments of ${input.step || '1'}.`
  return input.validationMessage
}

export const useAppRuntimeValidation = <Root extends HTMLElement>(
  root: RefObject<Root | null>,
  values: AppRuntimeSettingsDraft,
  fields: AppRuntimeFields,
  bounds: ResourceLimitBounds | null,
  modified?: AppRuntimeFields
) => {
  const [errors, setErrors] = useState<AppRuntimeFieldErrors>({})
  const { inactivityTimeoutSeconds, memoryLimitMb, cpuLimitCpus } = values
  const { inactivityTimeoutSeconds: checkTimeout, memoryLimitMb: checkMemory, cpuLimitCpus: checkCpu } = fields
  const checkModifiedTimeout = modified?.inactivityTimeoutSeconds ?? true
  const checkModifiedMemory = modified?.memoryLimitMb ?? true
  const checkModifiedCpu = modified?.cpuLimitCpus ?? true

  const validate = useCallback(() => {
    const selected = { inactivityTimeoutSeconds: checkTimeout, memoryLimitMb: checkMemory, cpuLimitCpus: checkCpu }
    const changed = {
      inactivityTimeoutSeconds: checkModifiedTimeout,
      memoryLimitMb: checkModifiedMemory,
      cpuLimitCpus: checkModifiedCpu
    }
    const next: AppRuntimeFieldErrors = {}
    for (const field of appRuntimeFields) {
      if (!selected[field]) continue
      const input = root.current?.querySelector<HTMLInputElement>(`input[type="number"][name="${field}"]`)
      // A native bad input can expose the same empty value as an unset limit.
      if (input?.willValidate && !input.validity.valid && (changed[field] || input.validity.badInput)) {
        next[field] = getNumberInputError(input)
      }
    }
    setErrors(current => (appRuntimeFields.every(field => current[field] === next[field]) ? current : next))
    return next
  }, [root, checkTimeout, checkMemory, checkCpu, checkModifiedTimeout, checkModifiedMemory, checkModifiedCpu])

  useLayoutEffect(() => {
    validate()
  }, [validate, inactivityTimeoutSeconds, memoryLimitMb, cpuLimitCpus, bounds?.maxMemoryMb, bounds?.maxCpuCpus])

  const onInput = (event: FormEvent<Root>) => {
    if (event.target instanceof HTMLInputElement && event.target.type === 'number') validate()
  }

  return { onInput, errors, validate }
}
