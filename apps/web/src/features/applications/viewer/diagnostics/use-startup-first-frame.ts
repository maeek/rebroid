'use client'

import { useCallback, useEffect, useState } from 'react'
import { startupRuntimeKey } from './startup-timings'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

type FirstFrame = { runtime: string; at: number }
const storageKey = 'rebroid.viewer.startup-first-frames.v1'
const maxRecords = 24
const readRecords = (): FirstFrame[] => {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? '[]')
    if (!Array.isArray(value)) return []
    return value
      .filter(
        (item: unknown): item is FirstFrame =>
          item !== null &&
          typeof item === 'object' &&
          'runtime' in item &&
          'at' in item &&
          typeof item.runtime === 'string' &&
          item.runtime.length <= 512 &&
          typeof item.at === 'number' &&
          Number.isFinite(new Date(item.at).getTime()) &&
          item.at > 0
      )
      .slice(-maxRecords)
  } catch {
    return []
  }
}

export const useStartupFirstFrame = (app?: AppDefinition) => {
  const runtime = startupRuntimeKey(app)
  const [record, setRecord] = useState<FirstFrame>()
  useEffect(() => {
    setRecord(readRecords().find(item => item.runtime === runtime))
  }, [runtime])

  const recordFirstFrame = useCallback(() => {
    if (!runtime) return
    const records = readRecords()
    const next = records.find(item => item.runtime === runtime) ?? { runtime, at: Date.now() }
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify([...records.filter(item => item.runtime !== runtime), next].slice(-maxRecords))
      )
    } catch {
      // Keep the observation in memory when browser storage is unavailable.
    }
    setRecord(current => (current?.runtime === runtime ? current : next))
  }, [runtime])

  return { firstFrameAt: record?.runtime === runtime ? record?.at : undefined, recordFirstFrame }
}
