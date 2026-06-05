'use client'

import { useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AutomationLiteralValueEditor } from '../editors/automation-literal-value-editor'
import { contextPaths, commonOutputPaths, outputPathsByUses } from './automation-value-ref-constants'
import { AutomationValueRefPathField } from './automation-value-ref-path-field'
import { defaultValueRef, uniqueValues } from './automation-value-ref-utils'
import type { AutomationStepReferenceOption } from './automation-value-ref-constants'
import type { AutomationValueRef } from '@/server/orchestrator/automations/types'
export function AutomationValueRefEditor({
  id,
  label,
  value,
  stepOptions,
  onChange
}: {
  id: string
  label: string
  value: AutomationValueRef
  stepOptions: AutomationStepReferenceOption[]
  onChange: (value: AutomationValueRef) => void
}) {
  const selectedStep = stepOptions.find(option => option.id === value.stepId)
  const stepPathOptions = useMemo(() => {
    const paths = selectedStep?.uses ? outputPathsByUses[selectedStep.uses] : undefined
    return uniqueValues([...commonOutputPaths, ...(paths ?? [])])
  }, [selectedStep?.uses])

  return (
    <div className='grid gap-3'>
      <Label>{label}</Label>
      <div className='grid gap-3 md:grid-cols-[12rem_minmax(0,1fr)]'>
        <div className='grid gap-2'>
          <Label htmlFor={`${id}-source`}>Source</Label>
          <Select
            value={value.source}
            onValueChange={source => onChange(defaultValueRef(source as AutomationValueRef['source'], stepOptions))}
          >
            <SelectTrigger
              id={`${id}-source`}
              className='w-full'
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='literal'>Literal</SelectItem>
              <SelectItem value='context'>Run context</SelectItem>
              <SelectItem value='step'>Step output</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {value.source === 'literal' ? (
          <AutomationLiteralValueEditor
            id={`${id}-literal`}
            value={value.value}
            onChange={literal => onChange({ source: 'literal', value: literal })}
          />
        ) : null}

        {value.source === 'context' ? (
          <AutomationValueRefPathField
            id={`${id}-context-path`}
            label='Context path'
            value={value.path ?? ''}
            options={contextPaths}
            onChange={path => onChange({ source: 'context', path })}
          />
        ) : null}

        {value.source === 'step' ? (
          <div className='grid gap-3 md:grid-cols-2'>
            <div className='grid gap-2'>
              <Label htmlFor={`${id}-step`}>Step</Label>
              <Select
                value={value.stepId ?? ''}
                onValueChange={stepId => onChange({ source: 'step', stepId, path: value.path || 'summary' })}
              >
                <SelectTrigger
                  id={`${id}-step`}
                  className='w-full'
                >
                  <SelectValue placeholder='Select step' />
                </SelectTrigger>
                <SelectContent>
                  {stepOptions.length === 0 ? (
                    <SelectItem
                      value='__none'
                      disabled
                    >
                      No previous steps
                    </SelectItem>
                  ) : (
                    stepOptions.map(option => (
                      <SelectItem
                        key={option.id}
                        value={option.id}
                      >
                        {option.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <AutomationValueRefPathField
              id={`${id}-step-path`}
              label='Output path'
              value={value.path ?? ''}
              options={stepPathOptions}
              onChange={path => onChange({ source: 'step', stepId: value.stepId ?? stepOptions[0]?.id ?? '', path })}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
