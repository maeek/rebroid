'use client'

import { operatorsForType } from '@rebroid/automation-core/metadata'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AutomationReferencePicker } from '../value-ref/automation-reference-picker'
import {
  conditionOperatorLabel,
  defaultCompareValue,
  defaultOperatorForType,
  needsCompareValue,
  typeForValueRef,
  valueRefLabel
} from '../value-ref/automation-value-ref-utils'
import { AutomationLiteralValueEditor } from './automation-literal-value-editor'
import type { AutomationStepReferenceOption } from '../value-ref/automation-value-ref-constants'
import type {
  AutomationConditionExpression,
  AutomationConditionOperator,
  AutomationConditionRule,
  AutomationValueRef
} from '@rebroid/automation-core/definition'

const createCondition = (): AutomationConditionRule => ({
  value: { source: 'runContext', key: 'targetApplicationId' },
  operator: 'exists'
})

const createGroup = () => ({ conditions: [createCondition()] })

export function AutomationConditionBuilder({
  id,
  label,
  value,
  stepOptions,
  onChange
}: {
  id: string
  label: string
  value: AutomationConditionExpression
  stepOptions: AutomationStepReferenceOption[]
  onChange: (value: AutomationConditionExpression) => void
}) {
  const groups = value.groups.length > 0 ? value.groups : [createGroup()]

  const updateCondition = (groupIndex: number, conditionIndex: number, condition: AutomationConditionRule) => {
    onChange({
      groups: groups.map((group, currentGroupIndex) =>
        currentGroupIndex === groupIndex
          ? {
              conditions: group.conditions.map((item, currentConditionIndex) =>
                currentConditionIndex === conditionIndex ? condition : item
              )
            }
          : group
      )
    })
  }

  const removeCondition = (groupIndex: number, conditionIndex: number) => {
    onChange({
      groups: groups
        .map((group, currentGroupIndex) =>
          currentGroupIndex === groupIndex
            ? { conditions: group.conditions.filter((_, index) => index !== conditionIndex) }
            : group
        )
        .filter(group => group.conditions.length > 0)
    })
  }

  return (
    <fieldset className='grid min-w-0 gap-4'>
      <legend className='mb-4 text-sm font-medium'>{label}</legend>
      <div className='grid min-w-0 gap-4'>
        {groups.map((group, groupIndex) => (
          <div
            key={groupIndex}
            className='grid gap-2'
          >
            {groupIndex > 0 ? <div className='text-xs font-medium text-foreground-muted'>Or</div> : null}
            <div className='grid gap-2'>
              {group.conditions.map((condition, conditionIndex) => (
                <ConditionRow
                  key={conditionIndex}
                  id={`${id}-g${groupIndex}-c${conditionIndex}`}
                  condition={condition}
                  stepOptions={stepOptions}
                  canDelete={groups.length > 1 || group.conditions.length > 1}
                  onChange={nextCondition => updateCondition(groupIndex, conditionIndex, nextCondition)}
                  onDelete={() => removeCondition(groupIndex, conditionIndex)}
                />
              ))}
            </div>
            <Button
              type='button'
              variant='secondary'
              size='sm'
              className='w-fit'
              onClick={() =>
                onChange({
                  groups: groups.map((item, index) =>
                    index === groupIndex ? { conditions: [...item.conditions, createCondition()] } : item
                  )
                })
              }
            >
              <IconPlus className='size-4' />
              And condition
            </Button>
          </div>
        ))}
        <Button
          type='button'
          variant='secondary'
          size='sm'
          className='w-fit'
          onClick={() => onChange({ groups: [...groups, createGroup()] })}
        >
          <IconPlus className='size-4' />
          Or group
        </Button>
      </div>
    </fieldset>
  )
}

function ConditionRow({
  id,
  condition,
  stepOptions,
  canDelete,
  onChange,
  onDelete
}: {
  id: string
  condition: AutomationConditionRule
  stepOptions: AutomationStepReferenceOption[]
  canDelete: boolean
  onChange: (condition: AutomationConditionRule) => void
  onDelete: () => void
}) {
  const selectedType = typeForValueRef(condition.value, stepOptions)
  const operators = operatorsForType(selectedType)
  const operator = operators.includes(condition.operator) ? condition.operator : defaultOperatorForType(selectedType)
  const compare = condition.compare ?? defaultCompareValue(selectedType)

  const setValue = (value: Exclude<AutomationValueRef, { source: 'literal' }>) => {
    const nextType = typeForValueRef(value, stepOptions)
    const nextOperator = defaultOperatorForType(nextType)
    onChange({
      value,
      operator: nextOperator,
      ...(needsCompareValue(nextOperator) ? { compare: defaultCompareValue(nextType) } : {})
    })
  }

  const setOperator = (nextOperator: AutomationConditionOperator) => {
    onChange({
      value: condition.value,
      operator: nextOperator,
      ...(needsCompareValue(nextOperator) ? { compare } : {})
    })
  }

  return (
    <div className='grid min-w-0 gap-4 rounded-control bg-control/25 p-3'>
      <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-3'>
        <div className='grid grid-cols-[repeat(auto-fit,minmax(min(14rem,100%),1fr))] gap-3'>
          {condition.value.source === 'literal' ? (
            <FormField
              label='Value'
              layout='vertical'
            >
              <Input
                readOnly
                value={valueRefLabel(condition.value, stepOptions)}
              />
            </FormField>
          ) : (
            <AutomationReferencePicker
              id={`${id}-value`}
              label='Value'
              value={condition.value}
              stepOptions={stepOptions}
              onChange={setValue}
            />
          )}
          <FormField
            controlId={`${id}-operator`}
            label='Condition'
            layout='vertical'
          >
            <Select
              value={operator}
              onValueChange={nextOperator => setOperator(nextOperator)}
            >
              <SelectTrigger
                id={`${id}-operator`}
                className='w-full'
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {operators.map(item => (
                  <SelectItem
                    key={item}
                    value={item}
                  >
                    {conditionOperatorLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <div className='flex items-end justify-end'>
          <Button
            type='button'
            variant='ghost'
            size='icon-md'
            aria-label='Delete condition'
            disabled={!canDelete}
            onClick={onDelete}
          >
            <IconTrash className='size-4 text-danger' />
          </Button>
        </div>
      </div>
      {needsCompareValue(operator) ? (
        <AutomationLiteralValueEditor
          id={`${id}-compare`}
          label='Compare with'
          value={compare.source === 'literal' ? compare.value : ''}
          onChange={literal => onChange({ ...condition, operator, compare: { source: 'literal', value: literal } })}
        />
      ) : null}
    </div>
  )
}
