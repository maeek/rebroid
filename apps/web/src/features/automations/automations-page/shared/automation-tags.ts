export interface AutomationTag {
  name: string
  color: string
}

export const defaultAutomationTagColor = '#64748b'

export const isHexColor = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value.trim())

export const normalizeTagName = (value: string) => value.trim()

export const normalizeTagColor = (value: string) =>
  isHexColor(value) ? value.trim().toLowerCase() : defaultAutomationTagColor

export const createAutomationTag = (name: string, color = defaultAutomationTagColor): AutomationTag => ({
  name: normalizeTagName(name),
  color: normalizeTagColor(color)
})

export function buildAutomationTagCatalog(names: string[], tags: AutomationTag[]) {
  const byName = new Map<string, AutomationTag>()
  for (const tag of [...tags, ...names.map(name => createAutomationTag(name))]) {
    const key = tag.name.trim().toLocaleLowerCase()
    if (key && !byName.has(key)) byName.set(key, tag)
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}
