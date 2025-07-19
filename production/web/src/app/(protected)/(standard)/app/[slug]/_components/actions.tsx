import { IconSettingsCog, IconRestore } from '@tabler/icons-react'
import classNames from 'classnames'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AppDefinition } from '../../../constants'

export const AppViewerActions = ({ className }: { app?: AppDefinition; className?: string }) => {
  return (
    <div
      className={classNames(
        'flex bg-card/60 bg-opacity-40 p-4 w-full min-h-16 rounded-xl gap-2 flex-wrap hover:bg-card/50 border border-input',
        className
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant='secondary'>
            <IconSettingsCog />
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
    </div>
  )
}
