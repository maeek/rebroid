import { useEffect, useState } from 'react'
import { collectSelectionKeys, firstStepKey } from '../steps/shared/automation-step-selection'
import type { AutomationStepForm } from './builder-utils'

export const useAutomationEditorSelection = (initialSteps: AutomationStepForm[]) => {
  const [selectedStepKey, setSelectedStepKey] = useState<string | null>(() => firstStepKey(initialSteps))
  const [openBlockKeys, setOpenBlockKeys] = useState<string[]>(() => collectSelectionKeys(initialSteps).blockKeys)
  const [yamlStepKey, setYamlStepKey] = useState<string | null>(null)

  const pruneSelectionForSteps = (steps: AutomationStepForm[]) => {
    const { stepKeys, blockKeys } = collectSelectionKeys(steps)
    const currentStepKeySet = new Set(stepKeys)
    const currentBlockKeySet = new Set(blockKeys)

    setSelectedStepKey(current => (current && currentStepKeySet.has(current) ? current : firstStepKey(steps)))
    setYamlStepKey(current => (current && currentStepKeySet.has(current) ? current : null))
    setOpenBlockKeys(current => current.filter(key => currentBlockKeySet.has(key)))
  }

  const resetSelectionForSteps = (steps: AutomationStepForm[]) => {
    setSelectedStepKey(firstStepKey(steps))
    setOpenBlockKeys(collectSelectionKeys(steps).blockKeys)
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
