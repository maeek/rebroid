import { isMap, isScalar, isSeq, type ParsedNode } from 'yaml'

const containsYamlOffset = (node: ParsedNode, offset: number) => {
  const range = node.range
  if (!range) return false
  const [start, , end] = range
  return offset >= start && offset <= end
}

export const yamlPathAt = (
  node: ParsedNode | null,
  offset: number,
  path: Array<string | number> = []
): Array<string | number> => {
  if (!node || !containsYamlOffset(node, offset)) return path

  if (isMap(node)) {
    for (const pair of node.items) {
      const key = isScalar(pair.key) ? String(pair.key.value) : null
      if (!key || !pair.value || !containsYamlOffset(pair.value, offset)) continue
      return yamlPathAt(pair.value, offset, [...path, key])
    }
    return path
  }

  if (isSeq(node)) {
    for (let index = 0; index < node.items.length; index += 1) {
      const item = node.items[index]
      if (!item || !containsYamlOffset(item, offset)) continue
      return yamlPathAt(item, offset, [...path, index])
    }
  }

  return path
}

export const yamlNodeAtPath = (node: ParsedNode | null, path: Array<string | number>): ParsedNode | null => {
  let current = node

  for (const pathItem of path) {
    if (typeof pathItem === 'string') {
      if (!current || !isMap(current)) return null
      const pair = current.items.find(item => isScalar(item.key) && item.key.value === pathItem)
      current = pair?.value ? pair.value : null
      continue
    }

    if (!current || !isSeq(current)) return null
    current = current.items[pathItem] ? current.items[pathItem] : null
  }

  return current
}
