import { useEffect, useState } from 'react'
import { collectBlockKeys, collectStepKeys, firstStepKey } from '../steps/shared/automation-step-selection'
import type { AutomationStepForm } from './builder-utils'

export const useAutomationEditorSelection = (initialSteps: AutomationStepForm[]) => {
  const [selectedStepKey, setSelectedStepKey] = useState<string | null>(() => firstStepKey(initialSteps))
  const [openBlockKeys, setOpenBlockKeys] = useState<string[]>(() => collectBlockKeys(initialSteps))
  const [yamlStepKey, setYamlStepKey] = useState<string | null>(null)

  const pruneSelectionForSteps = (steps: AutomationStepForm[]) => {
    const currentStepKeys = collectStepKeys(steps)
    const currentStepKeySet = new Set(currentStepKeys)
    const currentBlockKeySet = new Set(collectBlockKeys(steps))

    setSelectedStepKey(current => (current && currentStepKeySet.has(current) ? current : (currentStepKeys[0] ?? null)))
    setYamlStepKey(current => (current && currentStepKeySet.has(current) ? current : null))
    setOpenBlockKeys(current => current.filter(key => currentBlockKeySet.has(key)))
  }

  const resetSelectionForSteps = (steps: AutomationStepForm[]) => {
    setSelectedStepKey(firstStepKey(steps))
    setOpenBlockKeys(collectBlockKeys(steps))
    setYamlStepKey(null)
  }

  const toggleBlock = (clientKey: string) => {
    setOpenBlockKeys(current =>
      current.includes(clientKey) ? current.filter(key => key !== clientKey) : [...current, clientKey]
    )
  }

  const openBlock = (clientKey: string) => {
    setOpenBlockKeys(current => (current.includes(clientKey) ? current : [...current, clientKey]))
  }

  useEffect(() => {
    pruneSelectionForSteps(initialSteps)
  }, [initialSteps])

  return {
    openBlock,
    openBlockKeys,
    resetSelectionForSteps,
    selectedStepKey,
    setSelectedStepKey,
    setYamlStepKey,
    toggleBlock,
    yamlStepKey
  }
}
