'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'

export const WorkflowEditorWorkspace = ({
  details,
  children,
  yamlOpen,
  disabled = false,
  onToggleYaml
}: {
  details: ReactNode
  children: ReactNode
  yamlOpen: boolean
  disabled?: boolean
  onToggleYaml: () => void
}) => (
  <div className='grid min-w-0 gap-6'>
    {details}
    <Section
      surface='plain'
      title='Workflow steps'
      description={
        yamlOpen
          ? 'Edit the workflow source. Changes are shared with the visual editor.'
          : 'Select a step to configure it. Drag steps or use their move actions to change the order.'
      }
      actions={
        <div
          role='group'
          aria-label='Editor mode'
          className='flex items-center gap-1'
        >
          <Button
            type='button'
            size='sm'
            variant={yamlOpen ? 'ghost' : 'secondary'}
            aria-pressed={!yamlOpen}
            disabled={disabled}
            onClick={() => {
              if (yamlOpen) onToggleYaml()
            }}
          >
            Visual editor
          </Button>
          <Button
            type='button'
            size='sm'
            variant={yamlOpen ? 'secondary' : 'ghost'}
            aria-pressed={yamlOpen}
            disabled={disabled}
            onClick={() => {
              if (!yamlOpen) onToggleYaml()
            }}
          >
            YAML
          </Button>
        </div>
      }
      titleClassName='flex-wrap'
    >
      {children}
    </Section>
  </div>
)
