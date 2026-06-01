import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import { eq } from 'drizzle-orm'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

const webState = sqliteTable('web_state', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull()
})

type WebDatabase = {
  client: Database.Database
  orm: BetterSQLite3Database
}

let instance: WebDatabase | undefined
let instancePath: string | undefined

const databasePath = () => process.env.WEB_DATABASE_PATH || join(process.cwd(), 'data', 'web.sqlite')

const openDatabase = (): WebDatabase => {
  const path = databasePath()
  if (instance && instancePath === path) {
    return instance
  }

  instance?.client.close()
  mkdirSync(dirname(path), { recursive: true })
  const client = new Database(path)
  client.pragma('journal_mode = WAL')
  client.pragma('foreign_keys = ON')
  const schemaVersion = client.pragma('user_version', { simple: true }) as number
  if (schemaVersion === 0) {
    client.exec(`
      CREATE TABLE web_state (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      PRAGMA user_version = 1;
    `)
  } else if (schemaVersion !== 1) {
    client.close()
    throw new Error(`Unsupported web database schema version: ${schemaVersion}`)
  }
  instance = { client, orm: drizzle(client) }
  instancePath = path
  return instance
}

export const readWebState = (key: string) =>
  openDatabase().orm.select({ value: webState.value }).from(webState).where(eq(webState.key, key)).get()?.value ?? null

export const writeWebState = (key: string, value: string) => {
  openDatabase()
    .orm.insert(webState)
    .values({ key, value, updatedAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: webState.key,
      set: { value, updatedAt: new Date().toISOString() }
    })
    .run()
}

export const updateWebState = <Result>(key: string, update: (current: string | null) => [string, Result]) => {
  const { client } = openDatabase()
  return client.transaction(() => {
    const [value, result] = update(readWebState(key))
    writeWebState(key, value)
    return result
  })()
}

export const resetWebDatabaseForTests = () => {
  instance?.client.close()
  instance = undefined
  instancePath = undefined
}
