'use client'

import { IconPlus, IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  type AutomationConditionStepForm,
  type AutomationRepeatStepForm,
  type AutomationStepForm,
  type AutomationSwitchCaseForm,
  type AutomationSwitchStepForm,
  defaultStep
} from '../../editor/builder-utils'
import { AutomationReferencePicker } from '../value-ref/automation-reference-picker'
import { AutomationConditionBuilder } from './automation-condition-builder'
import { AutomationLiteralValueEditor } from './automation-literal-value-editor'
import type { AutomationStepReferenceOption } from '../value-ref/automation-value-ref-constants'

const createCase = (): AutomationSwitchCaseForm => ({
  clientKey: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
  value: 'value',
  steps: [defaultStep('debug.log', 1)]
})

export function AutomationStepBlockSettingsEditor({
  step,
  stepOptions,
  onChange
}: {
  step: Exclude<AutomationStepForm, { kind: 'action' }>
  stepOptions: AutomationStepReferenceOption[]
  onChange: (step: AutomationStepForm) => void
}) {
  if (step.kind === 'condition') {
    return (
      <ConditionBlockSettings
        step={step}
        stepOptions={stepOptions}
        onChange={onChange}
      />
    )
  }
  if (step.kind === 'switch') {
    return (
      <SwitchBlockSettings
        step={step}
        stepOptions={stepOptions}
        onChange={onChange}
      />
    )
  }
  return (
    <RepeatBlockSettings
      step={step}
      stepOptions={stepOptions}
      onChange={onChange}
    />
  )
}

function ConditionBlockSettings({
  step,
  stepOptions,
  onChange
}: {
  step: AutomationConditionStepForm
  stepOptions: AutomationStepReferenceOption[]
  onChange: (step: AutomationStepForm) => void
}) {
  return (
    <AutomationConditionBuilder
      id={`${step.clientKey}-condition`}
      label='Condition'
      value={step.condition}
      stepOptions={stepOptions}
      onChange={condition => onChange({ ...step, condition })}
    />
  )
}

function SwitchBlockSettings({
  step,
  stepOptions,
  onChange
}: {
  step: AutomationSwitchStepForm
  stepOptions: AutomationStepReferenceOption[]
  onChange: (step: AutomationStepForm) => void
}) {
  const switchValue =
    step.value.source === 'literal' ? { source: 'runContext' as const, key: 'targetProfileName' } : step.value
  const updateCase = (clientKey: string, patch: Partial<AutomationSwitchCaseForm>) => {
    onChange({
      ...step,
      cases: step.cases.map(item => (item.clientKey === clientKey ? { ...item, ...patch } : item))
    })
  }

  return (
    <div className='grid gap-5'>
      <AutomationReferencePicker
        id={`${step.clientKey}-switch-value`}
        label='Switch value'
        value={switchValue}
        stepOptions={stepOptions}
        onChange={value => onChange({ ...step, value })}
      />
      <div className='grid gap-3'>
        <div className='flex items-center justify-between gap-3'>
          <Label>Cases</Label>
          <Button
            type='button'
            size='sm'
            variant='secondary'
            onClick={() => onChange({ ...step, cases: [...step.cases, createCase()] })}
          >
            <IconPlus className='size-4' />
            Add case
          </Button>
        </div>
        {step.cases.length === 0 ? (
          <p className='rounded-md border border-dashed border-border/60 px-3 py-4 text-center text-sm text-foreground-muted'>
            No cases yet.
          </p>
        ) : null}
        {step.cases.map((item, index) => (
          <div
            key={item.clientKey}
            className='grid gap-3 rounded-md border border-border/60 bg-background/20 p-3'
          >
            <div className='flex items-end gap-2'>
              <div className='grid flex-1 gap-2'>
                <AutomationLiteralValueEditor
                  id={`${item.clientKey}-value`}
                  label={`Case ${index + 1} value`}
                  value={item.value}
                  onChange={value => updateCase(item.clientKey, { value })}
                />
              </div>
              <Button
                type='button'
                size='icon'
                variant='ghost'
                aria-label='Delete case'
                onClick={() =>
                  onChange({ ...step, cases: step.cases.filter(current => current.clientKey !== item.clientKey) })
                }
              >
                <IconTrash className='size-4 text-destructive' />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RepeatBlockSettings({
  step,
  stepOptions,
  onChange
}: {
  step: AutomationRepeatStepForm
  stepOptions: AutomationStepReferenceOption[]
  onChange: (step: AutomationStepForm) => void
}) {
  return (
    <div className='grid gap-5'>
      <div className='grid gap-2'>
        <Label>Mode</Label>
        <Select
          value={step.mode}
          onValueChange={mode => onChange({ ...step, mode: mode })}
        >
          <SelectTrigger className='w-48 max-w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='count'>Fixed count</SelectItem>
            <SelectItem value='while'>While condition</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {step.mode === 'count' ? (
        <NumberField
          id={`${step.clientKey}-count`}
          label='Count'
          value={step.count}
          onChange={count => onChange({ ...step, count, maxIterations: Math.max(step.maxIterations, count) })}
        />
      ) : (
        <AutomationConditionBuilder
          id={`${step.clientKey}-while`}
          label='While'
          value={step.while}
          stepOptions={stepOptions}
          onChange={whilePredicate => onChange({ ...step, while: whilePredicate })}
        />
      )}
      <NumberField
        id={`${step.clientKey}-max`}
        label='Max iterations'
        value={step.maxIterations}
        onChange={maxIterations => onChange({ ...step, maxIterations })}
      />
    </div>
  )
}

function NumberField({
  id,
  label,
  value,
  onChange
}: {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className='grid gap-2'>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type='number'
        min={1}
        value={value}
        onChange={event => onChange(Math.max(1, Number(event.target.value) || 1))}
      />
    </div>
  )
}
