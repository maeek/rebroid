'use client'

import type { ReactNode } from 'react'
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
} from '../editor/builder-utils'
import { AutomationLiteralValueEditor } from './automation-literal-value-editor'
import { AutomationPredicateEditor } from './automation-predicate-editor'
import { AutomationValueRefEditor } from './automation-value-ref-editor'
import type { AutomationStepReferenceOption } from './automation-value-ref-constants'

type RenderSteps = (
  steps: AutomationStepForm[],
  slot: string,
  onChange: (steps: AutomationStepForm[]) => void
) => ReactNode

const createCase = (): AutomationSwitchCaseForm => ({
  clientKey: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
  value: 'value',
  steps: [defaultStep('debug.log', 1)]
})

export function AutomationStepBlockEditor({
  step,
  stepOptions,
  onChange,
  renderSteps
}: {
  step: Exclude<AutomationStepForm, { kind: 'action' }>
  stepOptions: AutomationStepReferenceOption[]
  onChange: (step: AutomationStepForm) => void
  renderSteps: RenderSteps
}) {
  if (step.kind === 'condition') {
    return (
      <ConditionBlockEditor
        step={step}
        stepOptions={stepOptions}
        onChange={onChange}
        renderSteps={renderSteps}
      />
    )
  }
  if (step.kind === 'switch') {
    return (
      <SwitchBlockEditor
        step={step}
        stepOptions={stepOptions}
        onChange={onChange}
        renderSteps={renderSteps}
      />
    )
  }
  return (
    <RepeatBlockEditor
      step={step}
      stepOptions={stepOptions}
      onChange={onChange}
      renderSteps={renderSteps}
    />
  )
}

function ConditionBlockEditor({
  step,
  stepOptions,
  onChange,
  renderSteps
}: {
  step: AutomationConditionStepForm
  stepOptions: AutomationStepReferenceOption[]
  onChange: (step: AutomationStepForm) => void
  renderSteps: RenderSteps
}) {
  return (
    <div className='grid gap-5'>
      <AutomationPredicateEditor
        id={`${step.clientKey}-condition`}
        label='Condition'
        value={step.condition}
        stepOptions={stepOptions}
        onChange={condition => onChange({ ...step, condition })}
      />
      <NestedSection title='Then'>
        {renderSteps(step.thenSteps, `${step.clientKey}:then`, thenSteps => onChange({ ...step, thenSteps }))}
      </NestedSection>
      <NestedSection title='Else'>
        {renderSteps(step.elseSteps, `${step.clientKey}:else`, elseSteps => onChange({ ...step, elseSteps }))}
      </NestedSection>
    </div>
  )
}

function SwitchBlockEditor({
  step,
  stepOptions,
  onChange,
  renderSteps
}: {
  step: AutomationSwitchStepForm
  stepOptions: AutomationStepReferenceOption[]
  onChange: (step: AutomationStepForm) => void
  renderSteps: RenderSteps
}) {
  const updateCase = (clientKey: string, patch: Partial<AutomationSwitchCaseForm>) => {
    onChange({
      ...step,
      cases: step.cases.map(item => (item.clientKey === clientKey ? { ...item, ...patch } : item))
    })
  }

  return (
    <div className='grid gap-5'>
      <AutomationValueRefEditor
        id={`${step.clientKey}-switch-value`}
        label='Switch value'
        value={step.value}
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
        {step.cases.map((item, index) => (
          <div
            key={item.clientKey}
            className='grid gap-3 rounded-md border border-border/60 p-3'
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
            {renderSteps(item.steps, `${step.clientKey}:case:${item.clientKey}`, steps =>
              updateCase(item.clientKey, { steps })
            )}
          </div>
        ))}
      </div>
      <NestedSection title='Default'>
        {renderSteps(step.defaultSteps, `${step.clientKey}:default`, defaultSteps =>
          onChange({ ...step, defaultSteps })
        )}
      </NestedSection>
    </div>
  )
}

function RepeatBlockEditor({
  step,
  stepOptions,
  onChange,
  renderSteps
}: {
  step: AutomationRepeatStepForm
  stepOptions: AutomationStepReferenceOption[]
  onChange: (step: AutomationStepForm) => void
  renderSteps: RenderSteps
}) {
  return (
    <div className='grid gap-5'>
      <div className='grid gap-2'>
        <Label>Mode</Label>
        <Select
          value={step.mode}
          onValueChange={mode => onChange({ ...step, mode: mode as AutomationRepeatStepForm['mode'] })}
        >
          <SelectTrigger className='w-48'>
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
        <AutomationPredicateEditor
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
      <NestedSection title='Steps'>
        {renderSteps(step.steps, `${step.clientKey}:steps`, steps => onChange({ ...step, steps }))}
      </NestedSection>
    </div>
  )
}

function NestedSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className='grid gap-2 rounded-md border border-border/60 p-3'>
      <Label>{title}</Label>
      {children}
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
