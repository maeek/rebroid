'use client'

import { useMemo, useRef, useState } from 'react'
import {
  defaultForm,
  normalizePayload,
  scheduleToCron,
  taskToForm
} from '@/features/settings/scheduled-tasks/scheduled-tasks-page/schedule-utils'
import { useImmediateSave } from '@/hooks/use-immediate-save'
import { toast } from '@/hooks/use-toast'
import {
  createScheduledTaskAction,
  deleteScheduledTaskAction,
  runScheduledTaskNowAction,
  updateScheduledTaskAction
} from '@/server/orchestrator/scheduled-tasks/actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { isWorkflowHistoryRetentionTask } from '@/shared/contracts/scheduled-task'
import type { FormState, ScheduledTasksPageProps } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/types'
import type { ScheduledTask } from '@/shared/contracts/scheduled-task'

export const useScheduledTasksController = ({ initialActions, initialTasks }: ScheduledTasksPageProps) => {
  const firstActionType = initialActions[0]?.type ?? 'clean_orphaned_apk_files'
  const [tasks, setTasks] = useState(initialTasks)
  const [form, setForm] = useState<FormState>(() => defaultForm(firstActionType))
  const [baselineForm, setBaselineForm] = useState<FormState>(() => defaultForm(firstActionType))
  const [isFormOpen, setIsFormOpen] = useState(false)
  const toggleFeedback = useImmediateSave()
  const runningTask = useRef<string | null>(null)
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null)
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const actionByType = useMemo(() => new Map(initialActions.map(action => [action.type, action])), [initialActions])
  const enabledCount = tasks.filter(task => task.enabled).length
  const failedCount = tasks.filter(task => task.lastStatus === 'failed').length

  const resetForm = () => {
    const next = defaultForm(firstActionType)
    setForm(next)
    setBaselineForm(next)
  }

  const openCreateForm = () => {
    resetForm()
    setIsFormOpen(true)
  }

  const openEditForm = (task: ScheduledTask) => {
    const next = taskToForm(task)
    setForm(next)
    setBaselineForm(next)
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
      const cronExpression = scheduleToCron(form.schedule)
      const { name, enabled, actionType } = form
      const workflowHistoryTask = tasks.find(task => task.id === form.id && isWorkflowHistoryRetentionTask(task))
      const actionChanged = actionType !== baselineForm.actionType
      const payloadChanged = JSON.stringify(payload) !== JSON.stringify(normalizePayload(baselineForm))
      const update = {
        ...(!workflowHistoryTask && name !== baselineForm.name && { name }),
        ...(enabled !== baselineForm.enabled && { enabled }),
        ...(cronExpression !== scheduleToCron(baselineForm.schedule) && { cronExpression }),
        ...(!workflowHistoryTask && actionChanged && { actionType }),
        ...(((!workflowHistoryTask && actionChanged) || payloadChanged) && { payload })
      }
      let saved: ScheduledTask
      if (workflowHistoryTask && !Object.keys(update).length) {
        saved = workflowHistoryTask
      } else if (form.id) {
        saved = await updateScheduledTaskAction(form.id, update)
      } else {
        saved = await createScheduledTaskAction({ name, enabled, actionType, cronExpression, payload })
      }
      replaceTask(saved)
      setIsFormOpen(false)
      resetForm()
      toast({ title: form.id ? 'Scheduled task updated' : 'Scheduled task created' })
    } catch (error) {
      toast({
        title: 'Could not save scheduled task',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'danger'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const toggleEnabled = async (task: ScheduledTask, enabled: boolean, quiet = false) => {
    setBusyTaskId(task.id)
    try {
      await toggleFeedback.save(task.id, async () => {
        replaceTask(await updateScheduledTaskAction(task.id, { enabled }))
      })
    } catch (error) {
      if (quiet) throw error
      toast({
        title: 'Could not update scheduled task',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'danger'
      })
    } finally {
      setBusyTaskId(null)
    }
  }

  const runNow = async (task: ScheduledTask, quiet = false) => {
    if (runningTask.current !== null) return
    runningTask.current = task.id
    setRunningTaskId(task.id)
    try {
      const response = await runScheduledTaskNowAction(task.id)
      if (!response.ok && response.error.code === 'conflict') {
        if (quiet) throw new Error(`${task.name} is already running.`)
        toast({ title: 'Already running', description: task.name })
        return
      }
      const result = unwrapActionResult(response)
      replaceTask(result)
      if (result.lastStatus === 'failed') throw new Error('The task reported a failed run. Check its last result.')
      if (!quiet) toast({ title: 'Scheduled task completed' })
    } catch (error) {
      if (quiet) throw error
      toast({
        title: 'Could not run scheduled task',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'danger'
      })
    } finally {
      runningTask.current = null
      setRunningTaskId(null)
    }
  }

  const deleteTask = async (task: ScheduledTask, quiet = false) => {
    setBusyTaskId(task.id)
    try {
      await deleteScheduledTaskAction(task.id)
      setTasks(current => current.filter(item => item.id !== task.id))
      if (form.id === task.id) {
        setIsFormOpen(false)
        resetForm()
      }
      if (!quiet) toast({ title: 'Scheduled task deleted' })
    } catch (error) {
      if (quiet) throw error
      toast({
        title: 'Could not delete scheduled task',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'danger'
      })
    } finally {
      setBusyTaskId(null)
    }
  }

  const updateSchedule = (patch: Partial<FormState['schedule']>) => {
    setForm(current => ({ ...current, schedule: { ...current.schedule, ...patch } }))
  }

  return {
    baselineForm,
    actionByType,
    busyTaskId: busyTaskId ?? runningTaskId,
    runningTaskId,
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
    toggleFeedback,
    updateSchedule
  }
}
