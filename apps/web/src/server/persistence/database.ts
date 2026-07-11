import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import 'server-only'
import { freshWebSchema, webSchemaVersion } from './schema'

let database: Database.Database | undefined
let openedPath: string | undefined

const databasePath = () =>
  process.env.WEB_DATABASE_PATH || join(/*turbopackIgnore: true*/ process.cwd(), 'data', 'web.sqlite')

const applicationTableCount = (client: Database.Database) =>
  (
    client
      .prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .get() as { count: number }
  ).count

const incompatibleSchemaError = (version: number) =>
  new Error(
    `Unsupported web database schema version ${version}. Stop Rebroid and run "pnpm reset:all-state -- --execute".`
  )

export const getDatabase = () => {
  const path = databasePath()
  if (database && openedPath === path) return database

  database?.close()
  mkdirSync(dirname(path), { recursive: true })
  const client = new Database(path)
  client.pragma('journal_mode = WAL')
  client.pragma('foreign_keys = ON')
  const version = client.pragma('user_version', { simple: true }) as number

  if (version === 0 && applicationTableCount(client) === 0) {
    client.exec(freshWebSchema)
  } else if (version !== webSchemaVersion) {
    client.close()
    throw incompatibleSchemaError(version)
  }

  database = client
  openedPath = path
  return client
}

export const resetDatabaseForTests = () => {
  database?.close()
  database = undefined
  openedPath = undefined
}
