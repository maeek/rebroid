import { configureMonacoYaml } from 'monaco-yaml'
import type { JSONSchema, MonacoYaml, MonacoYamlOptions, SchemasSettings } from 'monaco-yaml'
import type * as Monaco from 'monaco-editor'

let yamlLanguage: MonacoYaml | null = null
let yamlUpdate = Promise.resolve()
let yamlLanguageDisabled = false
const schemasByModelUri = new Map<string, SchemasSettings>()

export const automationYamlMarkerOwner = 'rebroid-automation-yaml'

export const configureAutomationYamlLanguage = async ({
  monaco,
  modelUri,
  schema
}: {
  monaco: typeof Monaco
  modelUri: string
  schema: Record<string, unknown>
}) => {
  if (yamlLanguageDisabled) return null

  schemasByModelUri.set(modelUri, {
    uri: schemaUriForModel(modelUri),
    fileMatch: [modelUri],
    schema: schema as JSONSchema
  })
  try {
    await queueYamlLanguageUpdate(monaco)
  } catch (error) {
    schemasByModelUri.delete(modelUri)
    if (isAutomationYamlWorkerRequestHandlerError(error)) {
      disableAutomationYamlLanguage()
      return null
    }
    throw error
  }

  return {
    dispose() {
      schemasByModelUri.delete(modelUri)
      void queueYamlLanguageUpdate(monaco)
    }
  }
}

const queueYamlLanguageUpdate = (monaco: typeof Monaco) => {
  yamlUpdate = yamlUpdate.catch(() => undefined).then(() => updateYamlLanguage(monaco))
  return yamlUpdate
}

const updateYamlLanguage = async (monaco: typeof Monaco) => {
  if (yamlLanguageDisabled) return

  const options: MonacoYamlOptions = {
    completion: true,
    disableDefaultProperties: true,
    enableSchemaRequest: false,
    format: { enable: false },
    hover: true,
    indentation: '  ',
    parentSkeletonSelectedFirst: true,
    schemas: [...schemasByModelUri.values()],
    validate: true,
    yamlVersion: '1.2'
  }

  if (!yamlLanguage) {
    yamlLanguage = configureMonacoYaml(monaco as unknown as Parameters<typeof configureMonacoYaml>[0], options)
    return
  }

  await yamlLanguage.update(options)
}

const schemaUriForModel = (modelUri: string) =>
  `inmemory://rebroid/automation-yaml-schema/${encodeURIComponent(modelUri)}.json`

export const isAutomationYamlWorkerRequestHandlerError = (error: unknown) =>
  error instanceof Error && /Missing requestHandler or method/i.test(error.message)

export const disableAutomationYamlLanguage = () => {
  yamlLanguageDisabled = true
  schemasByModelUri.clear()
  yamlLanguage?.dispose()
  yamlLanguage = null
}

export const automationYamlLanguageIsDisabled = () => yamlLanguageDisabled
