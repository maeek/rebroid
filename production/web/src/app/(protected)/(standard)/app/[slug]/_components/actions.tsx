import { IconSettings, IconRestore } from '@tabler/icons-react'
import classNames from 'classnames'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AppDefinition } from '../../../constants'

export const AppViewerActions = ({ className }: { app?: AppDefinition; className?: string }) => {
  return (
    <Section className={classNames('flex-row gap-2', className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant='secondary'>
            <IconSettings />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Manage the App</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant='secondary'>
            <IconRestore />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Restart</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='secondary'
            onClick={() => {
              // Toggles hideOutline searchParam
              const url = new URL(window.location.href)
              const currentHideOutline = url.searchParams.get('hideOutline') === 'true'
              url.searchParams.set('hideOutline', String(!currentHideOutline))
              window.history.replaceState({}, '', url.toString())
            }}
          >
            Toggle Outline
          </Button>
        </TooltipTrigger>
        <TooltipContent>Toggle the device mockup outline</TooltipContent>
      </Tooltip>
    </Section>
  )
}
