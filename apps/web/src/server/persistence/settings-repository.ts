import 'server-only'
import { z } from 'zod'
import { getDatabase } from './database'

const settingsDocumentSchema = z.record(z.string(), z.unknown())

const parseSettings = (value: string) => settingsDocumentSchema.parse(JSON.parse(value))

export const readSettingsDocument = () => {
  const row = getDatabase().prepare('SELECT settings_json FROM web_settings WHERE id = 1').get() as
    | { settings_json: string }
    | undefined
  return row ? parseSettings(row.settings_json) : null
}

export const writeSettingsDocument = (settings: object) => {
  const parsed = settingsDocumentSchema.parse(settings)
  getDatabase()
    .prepare(
      'INSERT INTO web_settings (id, settings_json, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at'
    )
    .run(JSON.stringify(parsed), new Date().toISOString())
}

export const updateSettingsDocument = <Result>(
  update: (current: Record<string, unknown> | null) => [Record<string, unknown>, Result]
): Result => {
  const transaction = getDatabase().transaction(() => {
    const [settings, result] = update(readSettingsDocument())
    writeSettingsDocument(settings)
    return result
  })
  return transaction()
}
