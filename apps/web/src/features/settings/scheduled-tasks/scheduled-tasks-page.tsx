'use client'

import { useMemo, useState } from 'react'
import { IconDeviceFloppy, IconEdit, IconPlayerPlayFilled, IconPlus, IconTrash } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Visible } from '@/components/ui/visible'
import { PlatformPageHeader } from '@/features/orchestrator/components/platform-page-header'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { toast } from '@/hooks/use-toast'
import {
  createScheduledTaskAction,
  deleteScheduledTaskAction,
  runScheduledTaskNowAction,
  updateScheduledTaskAction
} from '@/server/orchestrator/scheduled-tasks/actions'
import type {
  SaveScheduledTaskInput,
  ScheduledTask,
  ScheduledTaskAction,
  ScheduledTaskActionType
} from '@/server/orchestrator/scheduled-tasks/types'

type FormState = Omit<SaveScheduledTaskInput, 'cronExpression'> & {
  id?: string
  kind?: ScheduledTask['kind']
  predefinedKey?: string | null
  schedule: ScheduleDraft
}

type ScheduleFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly'

type ScheduleDraft = {
  frequency: ScheduleFrequency
  intervalHours: number
  time: string
  weekday: string
  monthDay: number
}

const defaultSchedule: ScheduleDraft = {
  frequency: 'daily',
  intervalHours: 24,
  time: '03:00',
  weekday: '0',
  monthDay: 1
}

const weekdays = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' }
]

const actionNeedsDanglingOnly = (type: ScheduledTaskActionType) => type === 'prune_images'
const actionNeedsRetentionDays = (type: ScheduledTaskActionType) => type === 'clean_runtime_logs'

const defaultForm = (actionType: ScheduledTaskActionType): FormState => ({
  name: '',
  enabled: true,
  actionType,
  payload: {},
  schedule: defaultSchedule
})

const clampInteger = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, Math.trunc(Number.isFinite(value) ? value : minimum)))

const timeParts = (time: string) => {
  const [hour = '3', minute = '0'] = time.split(':')
  return {
    hour: clampInteger(Number(hour), 0, 23),
    minute: clampInteger(Number(minute), 0, 59)
  }
}

const scheduleToCron = (schedule: ScheduleDraft) => {
  const { hour, minute } = timeParts(schedule.time)
  if (schedule.frequency === 'hourly') {
    return `0 */${clampInteger(schedule.intervalHours, 1, 24)} * * *`
  }
  if (schedule.frequency === 'weekly') {
    return `${minute} ${hour} * * ${schedule.weekday}`
  }
  if (schedule.frequency === 'monthly') {
    return `${minute} ${hour} ${clampInteger(schedule.monthDay, 1, 28)} * *`
  }
  return `${minute} ${hour} * * *`
}

const cronToSchedule = (cronExpression: string): ScheduleDraft => {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = cronExpression.trim().split(/\s+/)
  if (minute === '0' && hour?.startsWith('*/') && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return { ...defaultSchedule, frequency: 'hourly', intervalHours: clampInteger(Number(hour.slice(2)), 1, 24) }
  }
  if (dayOfMonth === '*' && month === '*' && dayOfWeek && dayOfWeek !== '*') {
    return {
      ...defaultSchedule,
      frequency: 'weekly',
      time: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`,
      weekday: weekdays.some(day => day.value === dayOfWeek) ? dayOfWeek : '0'
    }
  }
  if (dayOfMonth && dayOfMonth !== '*' && month === '*' && dayOfWeek === '*') {
    return {
      ...defaultSchedule,
      frequency: 'monthly',
      time: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`,
      monthDay: clampInteger(Number(dayOfMonth), 1, 28)
    }
  }
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return { ...defaultSchedule, time: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` }
  }
  return defaultSchedule
}

const scheduleLabel = (cronExpression: string) => {
  const schedule = cronToSchedule(cronExpression)
  if (schedule.frequency === 'hourly') {
    return `Every ${schedule.intervalHours} ${schedule.intervalHours === 1 ? 'hour' : 'hours'}`
  }
  if (schedule.frequency === 'weekly') {
    return `Every ${weekdays.find(day => day.value === schedule.weekday)?.label ?? 'week'} at ${schedule.time}`
  }
  if (schedule.frequency === 'monthly') {
    return `Monthly on day ${schedule.monthDay} at ${schedule.time}`
  }
  return `Every day at ${schedule.time}`
}

const dateLabel = (value: string | null) => (value ? new Date(value).toLocaleString() : '-')

const statusVariant = (status: ScheduledTask['lastStatus']) => {
  if (status === 'success') return 'status'
  if (status === 'failed') return 'destructive'
  return 'secondary'
}

const statusLabel = (status: ScheduledTask['lastStatus']) => {
  if (status === 'never_run') return 'Never run'
  return status === 'success' ? 'Success' : 'Failed'
}

const taskToForm = (task: ScheduledTask): FormState => ({
  id: task.id,
  name: task.name,
  enabled: task.enabled,
  kind: task.kind,
  predefinedKey: task.predefinedKey,
  actionType: task.actionType,
  payload: task.payload ?? {},
  schedule: cronToSchedule(task.cronExpression)
})

const normalizePayload = (form: FormState) => {
  if (actionNeedsDanglingOnly(form.actionType)) {
    return { danglingOnly: form.payload?.danglingOnly ?? true }
  }

  if (actionNeedsRetentionDays(form.actionType)) {
    return { retentionDays: Number(form.payload?.retentionDays ?? 30) }
  }

  return null
}

export function ScheduledTasksPage({
  initialActions,
  initialTasks
}: {
  initialActions: ScheduledTaskAction[]
  initialTasks: ScheduledTask[]
}) {
  const firstActionType = initialActions[0]?.type ?? 'clean_uploaded_apks'
  const [tasks, setTasks] = useState(initialTasks)
  const [form, setForm] = useState<FormState>(() => defaultForm(firstActionType))
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const actionByType = useMemo(() => new Map(initialActions.map(action => [action.type, action])), [initialActions])
  const isEditing = Boolean(form.id)
  const isEditingPredefined = form.kind === 'predefined'
  const enabledCount = tasks.filter(task => task.enabled).length
  const failedCount = tasks.filter(task => task.lastStatus === 'failed').length

  const resetForm = () => setForm(defaultForm(firstActionType))

  const openCreateForm = () => {
    resetForm()
    setIsFormOpen(true)
  }

  const openEditForm = (task: ScheduledTask) => {
    setForm(taskToForm(task))
    setIsFormOpen(true)
  }

  const closeForm = (open: boolean) => {
    setIsFormOpen(open)
    if (!open && !isSaving) resetForm()
  }

  const replaceTask = (task: ScheduledTask) => {
    setTasks(current => {
      const exists = current.some(item => item.id === task.id)
      const next = exists ? current.map(item => (item.id === task.id ? task : item)) : [task, ...current]
      return next.sort((left, right) => {
        if (left.kind !== right.kind) return left.kind === 'predefined' ? -1 : 1
        return left.name.localeCompare(right.name)
      })
    })
  }

  const submitForm = async () => {
    setIsSaving(true)
    try {
      const payload = normalizePayload(form)
      const input = { ...form, cronExpression: scheduleToCron(form.schedule), payload }
      const saved = form.id ? await updateScheduledTaskAction(form.id, input) : await createScheduledTaskAction(input)
      replaceTask(saved)
      setIsFormOpen(false)
      resetForm()
      toast({ title: form.id ? 'Scheduled task updated' : 'Scheduled task created' })
    } catch (error) {
      toast({
        title: 'Could not save scheduled task',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const toggleEnabled = async (task: ScheduledTask, enabled: boolean) => {
    setBusyTaskId(task.id)
    try {
      replaceTask(await updateScheduledTaskAction(task.id, { enabled }))
    } catch (error) {
      toast({
        title: 'Could not update scheduled task',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusyTaskId(null)
    }
  }

  const runNow = async (task: ScheduledTask) => {
    setBusyTaskId(task.id)
    try {
      replaceTask(await runScheduledTaskNowAction(task.id))
      toast({ title: 'Scheduled task completed' })
    } catch (error) {
      toast({
        title: 'Could not run scheduled task',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusyTaskId(null)
    }
  }

  const deleteTask = async (task: ScheduledTask) => {
    setBusyTaskId(task.id)
    try {
      await deleteScheduledTaskAction(task.id)
      setTasks(current => current.filter(item => item.id !== task.id))
      if (form.id === task.id) {
        setIsFormOpen(false)
        resetForm()
      }
      toast({ title: 'Scheduled task deleted' })
    } catch (error) {
      toast({
        title: 'Could not delete scheduled task',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusyTaskId(null)
    }
  }

  const updateSchedule = (patch: Partial<ScheduleDraft>) => {
    setForm(current => ({ ...current, schedule: { ...current.schedule, ...patch } }))
  }

  return (
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <PlatformPageHeader
        title='Scheduled tasks'
        description='Recurring maintenance jobs with simple schedules.'
        includeOrchestratorBreadcrumb={false}
        actions={
          <Button
            className='max-sm:w-full'
            onClick={openCreateForm}
          >
            <IconPlus className='size-4' />
            New task
          </Button>
        }
      />
      <section className='grid w-full gap-6 px-6 pb-16 max-sm:px-4'>
        <div className='overflow-hidden rounded-lg border border-border/70 bg-card/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-md'>
          <div className='border-b border-border/60 px-5 py-4 max-sm:px-4'>
            <div className='grid gap-1'>
              <h3 className='font-medium text-foreground'>Tasks</h3>
              <p className='text-sm text-secondary-foreground'>
                {enabledCount} enabled · {tasks.length - enabledCount} paused · {failedCount} failed
              </p>
            </div>
          </div>
          <ScheduledTasksTable
            tasks={tasks}
            actionByType={actionByType}
            busyTaskId={busyTaskId}
            onEdit={openEditForm}
            onRun={task => void runNow(task)}
            onToggle={(task, enabled) => void toggleEnabled(task, enabled)}
            onDelete={task => void deleteTask(task)}
          />
        </div>
      </section>
      <Dialog
        open={isFormOpen}
        onOpenChange={closeForm}
      >
        <DialogContent className='sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit scheduled task' : 'New scheduled task'}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update the schedule and availability for this maintenance job.'
                : 'Create a recurring maintenance job with a simple schedule.'}
            </DialogDescription>
          </DialogHeader>
          <form
            className='grid gap-5'
            onSubmit={event => {
              event.preventDefault()
              void submitForm()
            }}
          >
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <label className='text-sm font-medium text-foreground'>Task details</label>
              <label className='flex items-center gap-3 text-sm text-foreground'>
                <Switch
                  checked={form.enabled ?? true}
                  onCheckedChange={enabled => setForm(current => ({ ...current, enabled }))}
                />
                Enabled
              </label>
            </div>
            <div className='grid gap-2'>
              <label className='text-sm font-medium text-foreground'>Name</label>
              <Input
                value={form.name}
                disabled={isEditingPredefined}
                placeholder='Nightly cleanup'
                onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div className='grid gap-2'>
              <label className='text-sm font-medium text-foreground'>Action</label>
              <Select
                value={form.actionType}
                disabled={isEditingPredefined}
                onValueChange={value =>
                  setForm(current => ({
                    ...current,
                    actionType: value as ScheduledTaskActionType,
                    payload: {}
                  }))
                }
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {initialActions.map(action => (
                    <SelectItem
                      key={action.type}
                      value={action.type}
                    >
                      {action.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className='text-sm text-secondary-foreground'>{actionByType.get(form.actionType)?.description}</p>
            </div>
            <ScheduleEditor
              schedule={form.schedule}
              onScheduleChange={updateSchedule}
            />
            <Visible when={actionNeedsDanglingOnly(form.actionType)}>
              <label className='flex items-center gap-2 text-sm text-foreground'>
                <Checkbox
                  checked={form.payload?.danglingOnly ?? true}
                  onCheckedChange={checked =>
                    setForm(current => ({
                      ...current,
                      payload: { ...current.payload, danglingOnly: checked === true }
                    }))
                  }
                />
                Dangling images only
              </label>
            </Visible>
            <Visible when={actionNeedsRetentionDays(form.actionType)}>
              <div className='grid gap-2'>
                <label className='text-sm font-medium text-foreground'>Remove logs older than</label>
                <div className='flex items-center gap-2'>
                  <Input
                    type='number'
                    min={1}
                    max={3650}
                    value={form.payload?.retentionDays ?? 30}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        payload: { ...current.payload, retentionDays: Number(event.target.value) }
                      }))
                    }
                  />
                  <span className='text-sm text-secondary-foreground'>days</span>
                </div>
              </div>
            </Visible>
            <DialogFooter>
              <Button
                type='button'
                variant='secondary'
                disabled={isSaving}
                onClick={() => closeForm(false)}
              >
                Cancel
              </Button>
              <Button
                type='submit'
                disabled={isSaving || form.name.trim().length < 2}
              >
                {isEditing ? <IconDeviceFloppy className='size-4' /> : <IconPlus className='size-4' />}
                {isEditing ? 'Save changes' : 'Create task'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ProtectedStackPageLayout>
  )
}

const ScheduleEditor = ({
  schedule,
  onScheduleChange
}: {
  schedule: ScheduleDraft
  onScheduleChange: (patch: Partial<ScheduleDraft>) => void
}) => (
  <div className='grid gap-3'>
    <label className='text-sm font-medium text-foreground'>Schedule</label>
    <div className='flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center'>
      <Select
        value={schedule.frequency}
        onValueChange={value => onScheduleChange({ frequency: value as ScheduleFrequency })}
      >
        <SelectTrigger className='w-full sm:w-auto sm:min-w-36 sm:shrink-0'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='hourly'>Every few hours</SelectItem>
          <SelectItem value='daily'>Every day</SelectItem>
          <SelectItem value='weekly'>Every week</SelectItem>
          <SelectItem value='monthly'>Every month</SelectItem>
        </SelectContent>
      </Select>
      <Visible when={schedule.frequency === 'hourly'}>
        <div className='flex min-w-0 items-center gap-2 sm:flex-1 sm:basis-64 sm:max-w-md'>
          <span className='text-sm text-secondary-foreground'>Every</span>
          <Input
            type='number'
            className='min-w-0 flex-1'
            min={1}
            max={24}
            value={schedule.intervalHours}
            onChange={event => onScheduleChange({ intervalHours: clampInteger(Number(event.target.value), 1, 24) })}
          />
          <span className='text-sm text-secondary-foreground'>hours</span>
        </div>
      </Visible>
      <Visible when={schedule.frequency !== 'hourly'}>
        <Input
          type='time'
          className='min-w-0 sm:flex-1 sm:basis-64 sm:max-w-md'
          value={schedule.time}
          onChange={event => onScheduleChange({ time: event.target.value || defaultSchedule.time })}
        />
      </Visible>
    </div>
    <Visible when={schedule.frequency === 'weekly'}>
      <Select
        value={schedule.weekday}
        onValueChange={weekday => onScheduleChange({ weekday })}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {weekdays.map(day => (
            <SelectItem
              key={day.value}
              value={day.value}
            >
              {day.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Visible>
    <Visible when={schedule.frequency === 'monthly'}>
      <div className='flex items-center gap-2'>
        <span className='text-sm text-secondary-foreground'>Day</span>
        <Input
          type='number'
          min={1}
          max={28}
          value={schedule.monthDay}
          onChange={event => onScheduleChange({ monthDay: clampInteger(Number(event.target.value), 1, 28) })}
        />
        <span className='text-sm text-secondary-foreground'>of each month</span>
      </div>
    </Visible>
  </div>
)

const ScheduledTasksTable = ({
  tasks,
  actionByType,
  busyTaskId,
  onEdit,
  onRun,
  onToggle,
  onDelete
}: {
  tasks: ScheduledTask[]
  actionByType: Map<ScheduledTaskActionType, ScheduledTaskAction>
  busyTaskId: string | null
  onEdit: (task: ScheduledTask) => void
  onRun: (task: ScheduledTask) => void
  onToggle: (task: ScheduledTask, enabled: boolean) => void
  onDelete: (task: ScheduledTask) => void
}) => (
  <>
    <div className='hidden lg:block'>
      <Table>
        <TableHeader className='bg-secondary/18'>
          <TableRow className='hover:bg-transparent'>
            <TableHead className='px-5'>Task</TableHead>
            <TableHead>State</TableHead>
            <TableHead>Schedule</TableHead>
            <TableHead>Next run</TableHead>
            <TableHead>Last run</TableHead>
            <TableHead className='text-center'>Enabled</TableHead>
            <TableHead className='px-5 text-right'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <Visible when={tasks.length === 0}>
            <TableRow>
              <TableCell
                colSpan={7}
                className='px-5 py-8 text-center text-secondary-foreground'
              >
                No scheduled tasks configured.
              </TableCell>
            </TableRow>
          </Visible>
          {tasks.map(task => (
            <TableRow
              key={task.id}
              className='hover:bg-secondary/22'
            >
              <TableCell className='min-w-64 px-5 py-4'>
                <div className='grid gap-1'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <span className='font-medium text-foreground'>{task.name}</span>
                    <Badge variant='secondary'>{task.kind === 'predefined' ? 'Built-in' : 'Custom'}</Badge>
                  </div>
                  <span className='text-secondary-foreground'>
                    {actionByType.get(task.actionType)?.label ?? task.actionType}
                  </span>
                  <Visible when={task.lastError}>
                    <span className='max-w-lg truncate text-destructive'>{task.lastError}</span>
                  </Visible>
                </div>
              </TableCell>
              <TableCell>
                <div className='flex flex-wrap gap-2'>
                  <Badge variant={task.enabled ? 'status' : 'secondary'}>{task.enabled ? 'Enabled' : 'Paused'}</Badge>
                  <Badge variant={statusVariant(task.lastStatus)}>{statusLabel(task.lastStatus)}</Badge>
                </div>
              </TableCell>
              <TableCell className='min-w-44 text-secondary-foreground'>{scheduleLabel(task.cronExpression)}</TableCell>
              <TableCell className='min-w-44 text-secondary-foreground'>{dateLabel(task.nextRunAt)}</TableCell>
              <TableCell className='min-w-44 text-secondary-foreground'>{dateLabel(task.lastRunAt)}</TableCell>
              <TableCell className='text-center'>
                <Switch
                  checked={task.enabled}
                  disabled={busyTaskId === task.id}
                  aria-label={`${task.enabled ? 'Disable' : 'Enable'} ${task.name}`}
                  onCheckedChange={enabled => onToggle(task, enabled)}
                />
              </TableCell>
              <TableCell className='px-5'>
                <div className='flex justify-end gap-2'>
                  <Button
                    size='sm'
                    variant='ghost'
                    disabled={busyTaskId === task.id}
                    onClick={() => onEdit(task)}
                  >
                    <IconEdit className='size-4' />
                    Edit
                  </Button>
                  <Button
                    size='sm'
                    variant='ghost'
                    disabled={busyTaskId === task.id}
                    onClick={() => onRun(task)}
                  >
                    <IconPlayerPlayFilled className='size-4' />
                    Run
                  </Button>
                  <Visible when={task.kind === 'custom'}>
                    <Button
                      size='sm'
                      variant='ghost'
                      aria-label={`Delete ${task.name}`}
                      disabled={busyTaskId === task.id}
                      onClick={() => onDelete(task)}
                    >
                      <IconTrash className='size-4 text-destructive' />
                    </Button>
                  </Visible>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    <div className='lg:hidden'>
      <Visible when={tasks.length === 0}>
        <p className='px-4 py-8 text-center text-sm text-secondary-foreground'>No scheduled tasks configured.</p>
      </Visible>
      {tasks.map(task => (
        <div
          key={task.id}
          className='grid gap-4 border-b border-border/60 px-4 py-4 last:border-b-0'
        >
          <div className='flex min-w-0 items-start justify-between gap-3'>
            <div className='min-w-0'>
              <div className='flex flex-wrap items-center gap-2'>
                <h3 className='font-medium text-foreground'>{task.name}</h3>
                <Badge variant='secondary'>{task.kind === 'predefined' ? 'Built-in' : 'Custom'}</Badge>
              </div>
              <p className='mt-1 text-sm text-secondary-foreground'>
                {actionByType.get(task.actionType)?.label ?? task.actionType}
              </p>
            </div>
            <Switch
              checked={task.enabled}
              disabled={busyTaskId === task.id}
              aria-label={`${task.enabled ? 'Disable' : 'Enable'} ${task.name}`}
              onCheckedChange={enabled => onToggle(task, enabled)}
            />
          </div>
          <div className='flex flex-wrap gap-2'>
            <Badge variant={task.enabled ? 'status' : 'secondary'}>{task.enabled ? 'Enabled' : 'Paused'}</Badge>
            <Badge variant={statusVariant(task.lastStatus)}>{statusLabel(task.lastStatus)}</Badge>
          </div>
          <dl className='grid grid-cols-2 gap-x-4 gap-y-3 text-sm'>
            <div className='col-span-2 grid gap-1'>
              <dt className='text-secondary-foreground'>Schedule</dt>
              <dd className='text-foreground'>{scheduleLabel(task.cronExpression)}</dd>
            </div>
            <div className='grid gap-1'>
              <dt className='text-secondary-foreground'>Next</dt>
              <dd className='text-foreground'>{dateLabel(task.nextRunAt)}</dd>
            </div>
            <div className='grid gap-1'>
              <dt className='text-secondary-foreground'>Last</dt>
              <dd className='text-foreground'>{dateLabel(task.lastRunAt)}</dd>
            </div>
            <Visible when={task.lastError}>
              <div className='col-span-2 grid gap-1'>
                <dt className='text-secondary-foreground'>Error</dt>
                <dd className='text-destructive'>{task.lastError}</dd>
              </div>
            </Visible>
          </dl>
          <div className='flex flex-wrap gap-2'>
            <Button
              size='sm'
              variant='secondary'
              disabled={busyTaskId === task.id}
              onClick={() => onEdit(task)}
            >
              <IconEdit className='size-4' />
              Edit
            </Button>
            <Button
              size='sm'
              variant='secondary'
              disabled={busyTaskId === task.id}
              onClick={() => onRun(task)}
            >
              <IconPlayerPlayFilled className='size-4' />
              Run now
            </Button>
            <Visible when={task.kind === 'custom'}>
              <Button
                size='sm'
                variant='ghost'
                disabled={busyTaskId === task.id}
                onClick={() => onDelete(task)}
              >
                <IconTrash className='size-4 text-destructive' />
                Delete
              </Button>
            </Visible>
          </div>
        </div>
      ))}
    </div>
  </>
)
