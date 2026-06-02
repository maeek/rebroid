'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  IconChevronDown,
  IconLoader2,
  IconPlayerPlayFilled,
  IconPlayerStopFilled,
  IconRestore
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Visible } from '@/components/ui/visible'
import { AppActionDialogSummary } from '@/features/applications/components/app-action-dialog-summary'
import {
  loadSavedApplicationProfiles,
  rememberApplicationProfile
} from '@/features/applications/profiles/profile-history'
import { ApplicationProfilePicker } from '@/features/applications/profiles/profile-picker'
import {
  startApplicationAction,
  stopApplicationAction
} from '@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions'
import { useAppViewerActionRunner } from './use-app-viewer-action-runner'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ApplicationProfileMode } from '@/server/orchestrator/applications/types'

type RuntimeConfirmationDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  summaryIcon: ReactNode
  summaryTitle: string
  summaryDescription: string
  details: string[]
  disabled: boolean
  isWorking: boolean
  buttonLabel: string
  workingLabel: string
  onConfirm: () => void
}

type RuntimeActionPhase = 'starting' | 'stopping' | 'restarting' | null

type RuntimeMenuAction = {
  key: string
  label: string
  icon: ReactNode
  disabled: boolean
  onSelect: () => void
}

type RuntimeActionRunner = (action: () => Promise<unknown>, title: string) => Promise<boolean>
type SetActionPhase = (phase: RuntimeActionPhase) => void
type SetSavedProfiles = (profiles: ReturnType<typeof loadSavedApplicationProfiles>) => void

type RuntimePowerControlsProps = {
  app?: AppDefinition
  canRunPrimary: boolean
  isBusy: boolean
  isRunningAction: boolean
  menuActions: RuntimeMenuAction[]
  menuDisabled: boolean
  primaryVariant: 'secondary' | 'update'
  primaryLabel: string
  primaryIcon: ReactNode
  onPrimaryAction: () => void
}

type StartProfileDialogProps = {
  app?: AppDefinition
  open: boolean
  profileMode: ApplicationProfileMode
  profileName: string
  savedProfiles: ReturnType<typeof loadSavedApplicationProfiles>
  isRunningAction: boolean
  onOpenChange: (open: boolean) => void
  onModeChange: (mode: ApplicationProfileMode) => void
  onNameChange: (name: string) => void
  onStart: () => void
}

type RuntimePowerDialogsProps = StartProfileDialogProps & {
  appName?: string
  dialogDisabled: boolean
  restartDialogOpen: boolean
  stopDialogOpen: boolean
  isRestartingAction: boolean
  isStoppingAction: boolean
  onRestartDialogOpenChange: (open: boolean) => void
  onStopDialogOpenChange: (open: boolean) => void
  onRestartConfirm: () => void
  onStopConfirm: () => void
}

type PowerActionRuntimeHandlersOptions = {
  app?: AppDefinition
  canRestart: boolean
  canStart: boolean
  canStop: boolean
  canSwitchProfile: boolean
  profileMode: ApplicationProfileMode
  profileName: string
  runAction: RuntimeActionRunner
  setRestartDialogOpen: (open: boolean) => void
  setSavedProfiles: SetSavedProfiles
  setStartDialogOpen: (open: boolean) => void
  setStopDialogOpen: (open: boolean) => void
}

type AppViewerPowerActionProps = {
  app?: AppDefinition
  canStart: boolean
  canStop: boolean
  canSwitchProfile: boolean
}

type PrimaryLabelKey = Exclude<RuntimeActionPhase, null> | 'running' | 'idle'

const runtimeActionLabels: Record<PrimaryLabelKey, string> = {
  starting: 'Starting...',
  stopping: 'Stopping...',
  restarting: 'Restarting...',
  running: 'Stop',
  idle: 'Start'
}

const getProfileDefaults = (app: AppDefinition) => ({
  mode: app.profileMode ?? 'persistent',
  name: app.profileName ?? 'default'
})

const getInitialProfileMode = (app?: AppDefinition): ApplicationProfileMode => app?.profileMode ?? 'persistent'

const getInitialProfileName = (app?: AppDefinition) => app?.profileName ?? 'default'

const getInitialSavedProfiles = (app?: AppDefinition) => {
  if (!app) {
    return []
  }

  return loadSavedApplicationProfiles(app.id, getProfileDefaults(app), app.savedProfiles)
}

const getNormalizedProfileName = (mode: ApplicationProfileMode, name: string) =>
  mode === 'temporary' ? 'temporary' : name.trim() || 'default'

const getNextProfileNameForMode = (mode: ApplicationProfileMode, currentName: string) => {
  if (mode === 'temporary') {
    return 'temporary'
  }

  return currentName === 'temporary' ? 'default' : currentName
}

const getIdlePrimaryLabelKey = (app: AppDefinition | undefined, isStopping: boolean): PrimaryLabelKey =>
  isStopping ? 'stopping' : app?.running ? 'running' : 'idle'

const getPrimaryLabel = (app: AppDefinition | undefined, phase: RuntimeActionPhase, isStopping: boolean) =>
  runtimeActionLabels[phase ?? getIdlePrimaryLabelKey(app, isStopping)]

const getPrimaryIcon = (app: AppDefinition | undefined, isStopping: boolean) => {
  if (isStopping) {
    return <IconLoader2 className='size-4 animate-spin' />
  }

  return app?.running ? <IconPlayerStopFilled className='size-4' /> : <IconPlayerPlayFilled className='size-4' />
}

const getIsStopping = (app?: AppDefinition) => app?.lifecycleStage === 'stopping'

const getIsBusy = (app: AppDefinition | undefined, isStopping: boolean) =>
  [app?.status === 'provisioning', app?.status === 'removing', isStopping].some(Boolean)

const getCanRestart = (canStart: boolean, canStop: boolean) => canStart && canStop

const getPrimaryVariant = (app?: AppDefinition): 'secondary' | 'update' => (app?.running ? 'secondary' : 'update')

const getCanRunPrimary = (app: AppDefinition | undefined, canStart: boolean, canStop: boolean) =>
  app?.running ? canStop : canStart

const canStartDefaults = (app: AppDefinition | undefined, canStart: boolean) => Boolean(app && !app.running && canStart)

const canStartProfile = (app: AppDefinition | undefined, canStart: boolean, canSwitchProfile: boolean) =>
  Boolean(app && !app.running && canStart && canSwitchProfile)

const canStopRuntime = (app: AppDefinition | undefined, canStop: boolean) => Boolean(app && app.running && canStop)

const canRestartRuntime = (app: AppDefinition | undefined, canRestart: boolean) =>
  Boolean(app && app.running && canRestart)

const isRuntimeMenuDisabled = (
  app: AppDefinition | undefined,
  isBusy: boolean,
  isRunningAction: boolean,
  canStart: boolean,
  canStop: boolean
) => {
  const hasAvailableAction = [canStart, canStop].some(Boolean)
  return [!app, isBusy, isRunningAction, !hasAvailableAction].some(Boolean)
}

const getStartedProfileOptions = (
  started: boolean,
  options?: { profileMode?: ApplicationProfileMode; profileName?: string }
) => {
  if (!started || !options?.profileMode) {
    return null
  }

  return { profileMode: options.profileMode, profileName: options.profileName }
}

const rememberStartedProfile = (
  appId: string,
  options: { profileMode: ApplicationProfileMode; profileName?: string },
  setSavedProfiles: SetSavedProfiles
) => {
  const profile = {
    mode: options.profileMode,
    name: options.profileName?.trim() || 'default'
  }

  rememberApplicationProfile(appId, profile)
  setSavedProfiles(loadSavedApplicationProfiles(appId, profile))
}

const startAppRuntime = async ({
  app,
  options,
  runAction,
  setActionPhase,
  setSavedProfiles
}: {
  app?: AppDefinition
  options?: { profileMode?: ApplicationProfileMode; profileName?: string }
  runAction: RuntimeActionRunner
  setActionPhase: SetActionPhase
  setSavedProfiles: SetSavedProfiles
}) => {
  if (!app) {
    return false
  }

  setActionPhase('starting')
  const started = await runAction(() => startApplicationAction(app.id, options), 'Could not start app')
  setActionPhase(null)

  const startedProfile = getStartedProfileOptions(started, options)

  if (startedProfile) {
    rememberStartedProfile(app.id, startedProfile, setSavedProfiles)
  }

  return started
}

const stopAppRuntime = async ({
  app,
  runAction,
  setActionPhase
}: {
  app?: AppDefinition
  runAction: RuntimeActionRunner
  setActionPhase: SetActionPhase
}) => {
  if (!app) {
    return false
  }

  setActionPhase('stopping')
  const stopped = await runAction(() => stopApplicationAction(app.id), 'Could not stop app')
  setActionPhase(null)
  return stopped
}

const restartAppRuntime = async ({
  app,
  runAction,
  setActionPhase
}: {
  app?: AppDefinition
  runAction: RuntimeActionRunner
  setActionPhase: SetActionPhase
}) => {
  if (!app) {
    return false
  }

  setActionPhase('restarting')
  const didSucceed = await runAction(async () => {
    await stopApplicationAction(app.id)
    await startApplicationAction(app.id)
  }, 'Could not restart app')
  setActionPhase(null)
  return didSucceed
}

const openPrimaryRuntimeAction = ({
  app,
  canSwitchProfile,
  onStart,
  onStartProfile,
  onStop
}: {
  app?: AppDefinition
  canSwitchProfile: boolean
  onStart: () => void
  onStartProfile: () => void
  onStop: () => void
}) => {
  if (!app) {
    return
  }

  if (app.running) {
    onStop()
    return
  }

  if (canSwitchProfile) {
    onStartProfile()
    return
  }

  onStart()
}

const closeDialogOnSuccess = (success: boolean, close: () => void) => {
  if (success) {
    close()
  }
}

const syncProfileStateFromApp = ({
  app,
  startDialogOpen,
  setProfileMode,
  setProfileName,
  setSavedProfiles
}: {
  app?: AppDefinition
  startDialogOpen: boolean
  setProfileMode: (mode: ApplicationProfileMode) => void
  setProfileName: (name: string) => void
  setSavedProfiles: SetSavedProfiles
}) => {
  if (!app || startDialogOpen) {
    return
  }

  const defaults = getProfileDefaults(app)
  setProfileMode(defaults.mode)
  setProfileName(defaults.name)
  setSavedProfiles(loadSavedApplicationProfiles(app.id, defaults, app.savedProfiles))
}

const createRuntimeMenuActions = ({
  app,
  canStart,
  canSwitchProfile,
  canStop,
  canRestart,
  onStartDefaults,
  onStartProfile,
  onStop,
  onRestart
}: {
  app?: AppDefinition
  canStart: boolean
  canSwitchProfile: boolean
  canStop: boolean
  canRestart: boolean
  onStartDefaults: () => void
  onStartProfile: () => void
  onStop: () => void
  onRestart: () => void
}): RuntimeMenuAction[] => [
  {
    key: 'start-defaults',
    label: 'Start with defaults',
    icon: <IconPlayerPlayFilled className='size-4' />,
    disabled: !canStartDefaults(app, canStart),
    onSelect: onStartDefaults
  },
  {
    key: 'start-profile',
    label: 'Start with profile',
    icon: <IconPlayerPlayFilled className='size-4' />,
    disabled: !canStartProfile(app, canStart, canSwitchProfile),
    onSelect: onStartProfile
  },
  {
    key: 'stop',
    label: 'Stop',
    icon: <IconPlayerStopFilled className='size-4' />,
    disabled: !canStopRuntime(app, canStop),
    onSelect: onStop
  },
  {
    key: 'restart',
    label: 'Restart',
    icon: <IconRestore className='size-4' />,
    disabled: !canRestartRuntime(app, canRestart),
    onSelect: onRestart
  }
]

const usePowerActionProfileState = (app: AppDefinition | undefined, startDialogOpen: boolean) => {
  const [profileMode, setProfileMode] = useState<ApplicationProfileMode>(() => getInitialProfileMode(app))
  const [profileName, setProfileName] = useState(() => getInitialProfileName(app))
  const [savedProfiles, setSavedProfiles] = useState(() => getInitialSavedProfiles(app))

  useEffect(() => {
    syncProfileStateFromApp({
      app,
      startDialogOpen,
      setProfileMode,
      setProfileName,
      setSavedProfiles
    })
  }, [app, startDialogOpen])

  const handleProfileModeChange = (mode: ApplicationProfileMode) => {
    setProfileMode(mode)
    setProfileName(current => getNextProfileNameForMode(mode, current))
  }

  return {
    profileMode,
    profileName,
    savedProfiles,
    setProfileName,
    setSavedProfiles,
    handleProfileModeChange
  }
}

const usePowerActionViewState = ({
  actionPhase,
  app,
  canStart,
  canStop,
  isRunningAction
}: {
  actionPhase: RuntimeActionPhase
  app?: AppDefinition
  canStart: boolean
  canStop: boolean
  isRunningAction: boolean
}) => {
  const isStopping = getIsStopping(app)
  const isBusy = getIsBusy(app, isStopping)

  return {
    canRestart: getCanRestart(canStart, canStop),
    canRunPrimary: getCanRunPrimary(app, canStart, canStop),
    dialogDisabled: isRuntimeMenuDisabled(app, isBusy, isRunningAction, true, true),
    isBusy,
    isStopping,
    menuDisabled: isRuntimeMenuDisabled(app, isBusy, isRunningAction, canStart, canStop),
    primaryIcon: getPrimaryIcon(app, isStopping),
    primaryLabel: getPrimaryLabel(app, actionPhase, isStopping),
    primaryVariant: getPrimaryVariant(app)
  }
}

const usePowerActionRuntimeHandlers = ({
  app,
  canRestart,
  canStart,
  canStop,
  canSwitchProfile,
  profileMode,
  profileName,
  runAction,
  setRestartDialogOpen,
  setSavedProfiles,
  setStartDialogOpen,
  setStopDialogOpen
}: PowerActionRuntimeHandlersOptions) => {
  const [actionPhase, setActionPhase] = useState<RuntimeActionPhase>(null)

  const handleStart = (options?: { profileMode?: ApplicationProfileMode; profileName?: string }) =>
    startAppRuntime({ app, options, runAction, setActionPhase, setSavedProfiles })

  const handleProfileStart = () => {
    void handleStart({
      profileMode,
      profileName: getNormalizedProfileName(profileMode, profileName)
    }).then(success => closeDialogOnSuccess(success, () => setStartDialogOpen(false)))
  }

  const handleStop = () => stopAppRuntime({ app, runAction, setActionPhase })

  const handleStopConfirm = () => {
    void handleStop().then(success => closeDialogOnSuccess(success, () => setStopDialogOpen(false)))
  }

  const handleRestart = async () => {
    const didSucceed = await restartAppRuntime({ app, runAction, setActionPhase })
    closeDialogOnSuccess(didSucceed, () => setRestartDialogOpen(false))
  }

  const handlePrimaryAction = () => {
    openPrimaryRuntimeAction({
      app,
      canSwitchProfile,
      onStart: () => void handleStart(),
      onStartProfile: () => setStartDialogOpen(true),
      onStop: () => setStopDialogOpen(true)
    })
  }

  const menuActions = createRuntimeMenuActions({
    app,
    canStart,
    canSwitchProfile,
    canStop,
    canRestart,
    onStartDefaults: () => void handleStart(),
    onStartProfile: () => setStartDialogOpen(true),
    onStop: () => setStopDialogOpen(true),
    onRestart: () => setRestartDialogOpen(true)
  })

  return {
    actionPhase,
    menuActions,
    handlePrimaryAction,
    handleProfileStart,
    handleRestart,
    handleStopConfirm
  }
}

const RuntimeConfirmationDialog = ({
  open,
  onOpenChange,
  title,
  description,
  summaryIcon,
  summaryTitle,
  summaryDescription,
  details,
  disabled,
  isWorking,
  buttonLabel,
  workingLabel,
  onConfirm
}: RuntimeConfirmationDialogProps) => (
  <Dialog
    open={open}
    onOpenChange={onOpenChange}
  >
    <DialogContent className='sm:max-w-md'>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <AppActionDialogSummary
        icon={summaryIcon}
        title={summaryTitle}
        description={summaryDescription}
        details={details}
        tone='warning'
      />
      <DialogFooter>
        <Button
          variant='secondary'
          disabled={isWorking}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          disabled={disabled}
          onClick={onConfirm}
        >
          <Visible when={isWorking}>
            <IconLoader2 className='size-4 animate-spin' />
          </Visible>
          {isWorking ? workingLabel : buttonLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)

const RuntimePowerControls = ({
  app,
  canRunPrimary,
  isBusy,
  isRunningAction,
  menuActions,
  menuDisabled,
  primaryVariant,
  primaryLabel,
  primaryIcon,
  onPrimaryAction
}: RuntimePowerControlsProps) => (
  <div className='inline-flex items-center'>
    <Button
      variant={primaryVariant}
      disabled={!app || !canRunPrimary || isBusy || isRunningAction}
      className='rounded-r-none border-r-0'
      onClick={onPrimaryAction}
    >
      <Visible
        when={isRunningAction}
        fallback={primaryIcon}
      >
        <IconLoader2 className='size-4 animate-spin' />
      </Visible>
      {primaryLabel}
    </Button>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={primaryVariant}
          size='icon'
          disabled={menuDisabled}
          className='rounded-l-none px-2'
          aria-label='Runtime actions'
        >
          <IconChevronDown className='size-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align='end'
        className='min-w-48'
      >
        {menuActions.map(action => (
          <DropdownMenuItem
            key={action.key}
            className='gap-2'
            disabled={action.disabled}
            onSelect={action.onSelect}
          >
            {action.icon}
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
)

const StartProfileDialog = ({
  app,
  open,
  profileMode,
  profileName,
  savedProfiles,
  isRunningAction,
  onOpenChange,
  onModeChange,
  onNameChange,
  onStart
}: StartProfileDialogProps) => (
  <Dialog
    open={open}
    onOpenChange={onOpenChange}
  >
    <DialogContent className='sm:max-w-md'>
      <DialogHeader>
        <DialogTitle>Start app</DialogTitle>
        <DialogDescription>Choose the saved profile for this session before the app starts.</DialogDescription>
      </DialogHeader>
      <ApplicationProfilePicker
        mode={profileMode}
        name={profileName}
        savedProfiles={savedProfiles}
        disabled={isRunningAction}
        onModeChange={onModeChange}
        onNameChange={onNameChange}
      />
      <DialogFooter>
        <Button
          variant='secondary'
          disabled={isRunningAction}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          variant='update'
          disabled={!app || isRunningAction}
          onClick={onStart}
        >
          <Visible when={isRunningAction}>
            <IconLoader2 className='size-4 animate-spin' />
          </Visible>
          <Visible when={!isRunningAction}>
            <IconPlayerPlayFilled className='size-4' />
          </Visible>
          Start
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)

const StopRuntimeDialog = ({
  appName,
  dialogDisabled,
  isStoppingAction,
  stopDialogOpen,
  onStopConfirm,
  onStopDialogOpenChange
}: Pick<
  RuntimePowerDialogsProps,
  'appName' | 'dialogDisabled' | 'isStoppingAction' | 'stopDialogOpen' | 'onStopConfirm' | 'onStopDialogOpenChange'
>) => (
  <RuntimeConfirmationDialog
    open={stopDialogOpen}
    onOpenChange={onStopDialogOpenChange}
    title={`Stop ${appName}?`}
    description='The app becomes unavailable immediately while network cleanup finishes in the background.'
    summaryIcon={<IconPlayerStopFilled className='size-4' />}
    summaryTitle='Stop the current session'
    summaryDescription='The Android container is terminated immediately. Saved profiles and the app record remain available.'
    details={[
      'Viewer sessions are released.',
      'Isolated network attachments are cleaned up after the container stops.'
    ]}
    disabled={dialogDisabled}
    isWorking={isStoppingAction}
    buttonLabel='Stop app'
    workingLabel='Stopping...'
    onConfirm={onStopConfirm}
  />
)

const RestartRuntimeDialog = ({
  appName,
  dialogDisabled,
  isRestartingAction,
  restartDialogOpen,
  onRestartConfirm,
  onRestartDialogOpenChange
}: Pick<
  RuntimePowerDialogsProps,
  | 'appName'
  | 'dialogDisabled'
  | 'isRestartingAction'
  | 'restartDialogOpen'
  | 'onRestartConfirm'
  | 'onRestartDialogOpenChange'
>) => (
  <RuntimeConfirmationDialog
    open={restartDialogOpen}
    onOpenChange={onRestartDialogOpenChange}
    title={`Restart ${appName}?`}
    description='The current container stops immediately, then a fresh session starts with the active profile and runtime settings.'
    summaryIcon={<IconRestore className='size-4' />}
    summaryTitle='Restart the Android runtime'
    summaryDescription='The viewer disconnects briefly while the container is stopped and Android boots again.'
    details={['Saved profile data is preserved.', 'The app may remain unavailable while Android finishes booting.']}
    disabled={dialogDisabled}
    isWorking={isRestartingAction}
    buttonLabel='Restart app'
    workingLabel='Restarting...'
    onConfirm={onRestartConfirm}
  />
)

const RuntimePowerDialogs = ({
  app,
  appName,
  dialogDisabled,
  isRestartingAction,
  isRunningAction,
  isStoppingAction,
  open,
  profileMode,
  profileName,
  restartDialogOpen,
  savedProfiles,
  stopDialogOpen,
  onModeChange,
  onNameChange,
  onOpenChange,
  onRestartConfirm,
  onRestartDialogOpenChange,
  onStart,
  onStopConfirm,
  onStopDialogOpenChange
}: RuntimePowerDialogsProps) => (
  <>
    <StartProfileDialog
      app={app}
      open={open}
      onOpenChange={onOpenChange}
      profileMode={profileMode}
      profileName={profileName}
      savedProfiles={savedProfiles}
      isRunningAction={isRunningAction}
      onModeChange={onModeChange}
      onNameChange={onNameChange}
      onStart={onStart}
    />
    <StopRuntimeDialog
      appName={appName}
      dialogDisabled={dialogDisabled}
      isStoppingAction={isStoppingAction}
      stopDialogOpen={stopDialogOpen}
      onStopConfirm={onStopConfirm}
      onStopDialogOpenChange={onStopDialogOpenChange}
    />
    <RestartRuntimeDialog
      appName={appName}
      dialogDisabled={dialogDisabled}
      isRestartingAction={isRestartingAction}
      restartDialogOpen={restartDialogOpen}
      onRestartConfirm={onRestartConfirm}
      onRestartDialogOpenChange={onRestartDialogOpenChange}
    />
  </>
)

export const AppViewerPowerAction = ({ app, canStart, canStop, canSwitchProfile }: AppViewerPowerActionProps) => {
  const { isRunningAction, runAction } = useAppViewerActionRunner()
  const [startDialogOpen, setStartDialogOpen] = useState(false)
  const [stopDialogOpen, setStopDialogOpen] = useState(false)
  const [restartDialogOpen, setRestartDialogOpen] = useState(false)
  const { profileMode, profileName, savedProfiles, setProfileName, setSavedProfiles, handleProfileModeChange } =
    usePowerActionProfileState(app, startDialogOpen)
  const runtimeHandlers = usePowerActionRuntimeHandlers({
    app,
    canRestart: getCanRestart(canStart, canStop),
    canStart,
    canStop,
    canSwitchProfile,
    profileMode,
    profileName,
    runAction,
    setRestartDialogOpen,
    setSavedProfiles,
    setStartDialogOpen,
    setStopDialogOpen
  })
  const viewState = usePowerActionViewState({
    actionPhase: runtimeHandlers.actionPhase,
    app,
    canStart,
    canStop,
    isRunningAction
  })

  return (
    <>
      <RuntimePowerControls
        app={app}
        canRunPrimary={viewState.canRunPrimary}
        isBusy={viewState.isBusy}
        isRunningAction={isRunningAction}
        menuActions={runtimeHandlers.menuActions}
        menuDisabled={viewState.menuDisabled}
        primaryVariant={viewState.primaryVariant}
        primaryLabel={viewState.primaryLabel}
        primaryIcon={viewState.primaryIcon}
        onPrimaryAction={runtimeHandlers.handlePrimaryAction}
      />
      <RuntimePowerDialogs
        app={app}
        appName={app?.name}
        dialogDisabled={viewState.dialogDisabled}
        open={startDialogOpen}
        onOpenChange={setStartDialogOpen}
        profileMode={profileMode}
        profileName={profileName}
        restartDialogOpen={restartDialogOpen}
        savedProfiles={savedProfiles}
        stopDialogOpen={stopDialogOpen}
        isRestartingAction={runtimeHandlers.actionPhase === 'restarting'}
        isRunningAction={isRunningAction}
        isStoppingAction={runtimeHandlers.actionPhase === 'stopping'}
        onModeChange={handleProfileModeChange}
        onNameChange={setProfileName}
        onRestartConfirm={() => void runtimeHandlers.handleRestart()}
        onRestartDialogOpenChange={setRestartDialogOpen}
        onStart={runtimeHandlers.handleProfileStart}
        onStopConfirm={runtimeHandlers.handleStopConfirm}
        onStopDialogOpenChange={setStopDialogOpen}
      />
    </>
  )
}
