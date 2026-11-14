'use client'

import { IconPlus, IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  type AutomationConditionStepForm,
  type AutomationRepeatStepForm,
  type AutomationStepForm,
  type AutomationSwitchCaseForm,
  type AutomationSwitchStepForm
} from '../../editor/builder-utils'
import { AutomationReferencePicker } from '../value-ref/automation-reference-picker'
import { defaultLiteralValue, literalKind, typeForValueRef } from '../value-ref/automation-value-ref-utils'
import { AutomationConditionBuilder } from './automation-condition-builder'
import { AutomationLiteralValueEditor } from './automation-literal-value-editor'
import type { AutomationStepReferenceOption } from '../value-ref/automation-value-ref-constants'

const createCase = (value: unknown): AutomationSwitchCaseForm => ({
  clientKey: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
  value,
  steps: []
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
  const valueType = typeForValueRef(step.value, stepOptions)
  const newCaseValue = valueType === 'number' || valueType === 'boolean' ? defaultLiteralValue(valueType) : ''
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
        label='Value to match'
        value={step.value}
        stepOptions={stepOptions}
        onChange={value => onChange({ ...step, value })}
      />
      <Section
        surface='plain'
        title='Cases'
        description='Runs the first exact match. Otherwise, the workflow uses the Otherwise branch when it has steps.'
        contentClassName='gap-3'
      >
        <Button
          type='button'
          size='sm'
          variant='secondary'
          className='justify-self-start'
          onClick={() => onChange({ ...step, cases: [...step.cases, createCase(newCaseValue)] })}
        >
          <IconPlus className='size-4' />
          Add case
        </Button>
        {step.cases.map((item, index) => (
          <div
            key={item.clientKey}
            className='grid min-w-0 gap-4 rounded-control bg-control/25 p-3'
          >
            <div className='flex items-end gap-2'>
              <div className='grid flex-1 gap-2'>
                <AutomationLiteralValueEditor
                  id={`${item.clientKey}-value`}
                  label={`Case ${index + 1} value`}
                  value={item.value}
                  onChange={value => updateCase(item.clientKey, { value })}
                />
                {step.cases.slice(0, index).some(previous => Object.is(previous.value, item.value)) ? (
                  <p className='text-xs text-warning'>An earlier case already matches this value.</p>
                ) : null}
                {valueType !== 'unknown' && literalKind(item.value) !== valueType ? (
                  <p className='text-xs text-warning'>This case has a different type from the value being matched.</p>
                ) : null}
              </div>
              <Button
                type='button'
                size='icon-md'
                variant='ghost'
                aria-label='Delete case'
                onClick={() =>
                  onChange({ ...step, cases: step.cases.filter(current => current.clientKey !== item.clientKey) })
                }
              >
                <IconTrash className='size-4 text-danger' />
              </Button>
            </div>
          </div>
        ))}
      </Section>
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
      <FormField
        label='Mode'
        layout='vertical'
      >
        <Select
          value={step.mode}
          onValueChange={mode => onChange({ ...step, mode: mode })}
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='count'>Repeat a fixed number of times</SelectItem>
            <SelectItem value='while'>While condition is true</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      {step.mode === 'count' ? (
        <NumberField
          id={`${step.clientKey}-count`}
          label='Number of times'
          value={step.count}
          onChange={count => onChange({ ...step, count, maxIterations: Math.max(step.maxIterations, count) })}
        />
      ) : (
        <AutomationConditionBuilder
          id={`${step.clientKey}-while`}
          label='While condition is true'
          value={step.while}
          stepOptions={stepOptions}
          onChange={whilePredicate => onChange({ ...step, while: whilePredicate })}
        />
      )}
      {step.mode === 'while' || step.maxIterations < step.count ? (
        <NumberField
          id={`${step.clientKey}-max`}
          label='Maximum iterations'
          description={
            step.mode === 'while'
              ? 'The condition is checked before each iteration. The body may run zero times.'
              : 'This cap limits the number of repetitions.'
          }
          value={step.maxIterations}
          onChange={maxIterations => onChange({ ...step, maxIterations })}
        />
      ) : null}
    </div>
  )
}

function NumberField({
  id,
  label,
  description,
  value,
  onChange
}: {
  id: string
  label: string
  description?: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <FormField
      layout='vertical'
      controlId={id}
      label={label}
      description={description}
      error={value > 1000 || !Number.isInteger(value) ? 'Enter a whole number from 1 to 1,000.' : undefined}
    >
      <Input
        id={id}
        type='number'
        min={1}
        max={1000}
        className='w-full'
        value={value}
        onChange={event => onChange(Math.max(1, Number(event.target.value) || 1))}
      />
    </FormField>
  )
}
