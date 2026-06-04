'use client'

import { useMemo, useState } from 'react'
import {
  defaultForm,
  normalizePayload,
  scheduleToCron,
  taskToForm
} from '@/features/settings/scheduled-tasks/scheduled-tasks-page/schedule-utils'
import { toast } from '@/hooks/use-toast'
import {
  createScheduledTaskAction,
  deleteScheduledTaskAction,
  runScheduledTaskNowAction,
  updateScheduledTaskAction
} from '@/server/orchestrator/scheduled-tasks/actions'
import type { FormState, ScheduledTasksPageProps } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/types'
import type { ScheduledTask } from '@/server/orchestrator/scheduled-tasks/types'

export const useScheduledTasksController = ({ initialActions, initialTasks }: ScheduledTasksPageProps) => {
  const firstActionType = initialActions[0]?.type ?? 'clean_uploaded_apks'
  const [tasks, setTasks] = useState(initialTasks)
  const [form, setForm] = useState<FormState>(() => defaultForm(firstActionType))
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const actionByType = useMemo(() => new Map(initialActions.map(action => [action.type, action])), [initialActions])
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

  const updateSchedule = (patch: Partial<FormState['schedule']>) => {
    setForm(current => ({ ...current, schedule: { ...current.schedule, ...patch } }))
  }

  return {
    actionByType,
    busyTaskId,
    enabledCount,
    failedCount,
    form,
    isFormOpen,
    isSaving,
    tasks,
    closeForm,
    deleteTask,
    openCreateForm,
    openEditForm,
    runNow,
    setForm,
    submitForm,
    toggleEnabled,
    updateSchedule
  }
}
