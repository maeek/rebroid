'use client'

import { cloneElement, createContext, useContext, useId, useRef, useState, type ReactElement } from 'react'
import { actionInputBinding, actionInputBindingType } from '@rebroid/automation-core/command-registry'
import { IconLink, IconUnlink } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SingleSelectCombobox } from '@/components/ui/single-select-combobox'
import type { AutomationStepReferenceOption } from './automation-value-ref-constants'
import type { AutomationCommand } from '@/shared/contracts/automation'

export const AutomationInputContext = createContext<{
  command?: AutomationCommand
  input: Record<string, unknown>
  stepOptions: AutomationStepReferenceOption[]
  patchInput: (patch: Record<string, unknown>) => void
} | null>(null)

export function useAutomationField(field?: string) {
  const context = useContext(AutomationInputContext)
  const command = context?.command
  const properties = command?.inputSchema.properties
  const rawProperty: unknown =
    field && properties && typeof properties === 'object' ? Reflect.get(properties, field) : undefined
  const property = rawProperty && typeof rawProperty === 'object' ? (rawProperty as Record<string, unknown>) : undefined
  const type = field && command ? actionInputBindingType(command.uses, field, property) : undefined
  return { context, property, type }
}

export function AutomationBoundControl({
  field,
  label,
  children,
  ...attributes
}: {
  field?: string
  label: string
  children: ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}) {
  const { context, type } = useAutomationField(field)
  const [open, setOpen] = useState(false)
  const literal = useRef<{ value: unknown } | null>(null)
  const searchId = useId()
  if (!field || !type || !context) return cloneElement(children, attributes)
  const current = actionInputBinding(context.input[field])
  const options = context.stepOptions.flatMap(step =>
    step.outputs
      .filter(output => output.type === type)
      .map(output => ({
        value: JSON.stringify([step.id, output.key]),
        label: output.label,
        description: output.description,
        group: step.label === step.id ? step.id : `${step.label} · ${step.id}`,
        reference: { source: 'stepOutput', stepId: step.id, outputKey: output.key }
      }))
  )
  if (!current && !options.length) return cloneElement(children, attributes)
  const selected = current ? JSON.stringify([current.stepId, current.outputKey]) : ''
  const selectedOption = options.find(option => option.value === selected)
  const referenceLabel = selectedOption
    ? `${selectedOption.group} → ${selectedOption.label}`
    : `${current?.stepId} → ${current?.outputKey} (unavailable)`
  return (
    <div className='flex w-full min-w-0 items-start gap-2'>
      <div className='min-w-0 flex-1'>
        {current ? (
          <div
            {...attributes}
            className='flex min-h-9 items-center gap-2 rounded-control bg-primary/10 px-3 py-2 text-sm text-foreground'
          >
            <IconLink
              aria-hidden
              className='size-4 shrink-0 text-primary'
            />
            <span className='break-words [overflow-wrap:anywhere]'>{referenceLabel}</span>
          </div>
        ) : (
          cloneElement(children, attributes)
        )}
      </div>
      {options.length ? (
        <Popover
          open={open}
          onOpenChange={setOpen}
        >
          <PopoverTrigger asChild>
            <Button
              type='button'
              variant='ghost'
              size='icon-md'
              aria-label={`Use step output for ${label}`}
              title='Use step output'
            >
              <IconLink
                aria-hidden
                className='size-4'
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align='end'
            className='grid w-80 max-w-[calc(100vw-2rem)] gap-2 p-2'
            initialFocus={() => document.getElementById(searchId)}
          >
            <SingleSelectCombobox
              inline
              id={searchId}
              aria-label={`Find a step output for ${label}`}
              placeholder='Search step outputs'
              options={options}
              value={selected}
              onValueChange={value => {
                const option = options.find(item => item.value === value)
                if (!option) return
                if (!current) literal.current = { value: context.input[field] }
                context.patchInput({ [field]: { $ref: option.reference } })
                setOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
      ) : null}
      {current ? (
        <Button
          type='button'
          variant='ghost'
          size='icon-md'
          aria-label={`Remove output reference for ${label}`}
          title='Use a literal value'
          onClick={() => {
            const previous = literal.current ? literal.current.value : context.command?.editor.inputDefaults[field]
            context.patchInput({ [field]: previous })
          }}
        >
          <IconUnlink
            aria-hidden
            className='size-4'
          />
        </Button>
      ) : null}
    </div>
  )
}
