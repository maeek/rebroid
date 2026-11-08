import { useId } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { modelPurposes, normalizeModelRoles } from './provider-model-usage'
import type { AutomationAiProviderModelRole } from './provider-form-model'

export const ProviderModelPurposes = ({
  roles,
  onChange,
  disabled = false
}: {
  roles: AutomationAiProviderModelRole[]
  onChange: (roles: AutomationAiProviderModelRole[]) => void
  disabled?: boolean
}) => {
  const id = useId()
  return (
    <fieldset
      className='grid gap-3'
      disabled={disabled}
    >
      <legend className='mb-3 text-sm font-medium'>Use this model for</legend>
      {modelPurposes.map(({ role, label, description }) => (
        <label
          htmlFor={`${id}-${role}`}
          key={role}
          className='flex items-start gap-3 text-sm'
        >
          <Checkbox
            id={`${id}-${role}`}
            className='mt-0.5'
            checked={roles.includes(role)}
            disabled={
              disabled ||
              (role === 'controller' && roles.includes('planner')) ||
              (roles.length === 1 && roles.includes(role))
            }
            onCheckedChange={checked =>
              onChange(normalizeModelRoles(checked ? [...roles, role] : roles.filter(item => item !== role)))
            }
          />
          <span className='grid gap-1'>
            <span className='font-medium'>{label}</span>
            <span className='text-xs text-foreground-muted'>{description}</span>
          </span>
        </label>
      ))}
      <p className='text-xs text-foreground-muted'>
        Assign purposes supported by the model. These assignments do not add model capabilities.
      </p>
    </fieldset>
  )
}
