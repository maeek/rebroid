const nodeTag =
  /<!--[\s\S]*?-->|<\/node\s*>|<node(?=[\s/>])(?:[^"'<>]|"[^"]*"|'[^']*')*>/g;
const hierarchyStart =
  /^\s*(?:<\?xml\s+[^?]*\?>\s*)?<hierarchy(?=[\s/>])(?:[^"'<>]|"[^"]*"|'[^']*')*>/;
const hierarchyEnd = /<\/hierarchy\s*>\s*$/;
const attribute = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const boundsPattern = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/;
const xmlEntities: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  quot: '"',
};

export type UiTextMatch = "exact" | "contains";

export const hasCompleteUiHierarchy = (xml: string) => {
  const start = xml.match(hierarchyStart)?.[0];
  if (!start) return false;
  if (start.endsWith("/>")) return !xml.slice(start.length).trim();
  const end = hierarchyEnd.exec(xml);
  if (!end) return false;

  let depth = 0;
  let offset = 0;
  const body = xml.slice(start.length, end.index);
  for (const { 0: tag, index } of body.matchAll(nodeTag)) {
    if (body.slice(offset, index).trim()) return false;
    offset = index + tag.length;
    if (tag.startsWith("<!--") || tag.endsWith("/>")) continue;
    depth += tag.startsWith("</") ? -1 : 1;
    if (depth < 0) return false;
  }
  return depth === 0 && !body.slice(offset).trim();
};

export function findUiTextTarget(
  xml: string,
  text: string,
  match: UiTextMatch,
  { requireEnabled = true } = {},
) {
  const query = text.normalize();
  if (!query.trim()) return null;

  for (const { bounds, enabled, text, description } of visibleUiNodes(xml)) {
    if (requireEnabled && !enabled) continue;
    const matches = [text, description].some((label) =>
      match === "exact" ? label === query : label?.includes(query),
    );
    if (!matches) continue;
    const { left, top, right, bottom } = bounds;
    return {
      x: left + Math.floor((right - left) / 2),
      y: top + Math.floor((bottom - top) / 2),
    };
  }
  return null;
}

export function* visibleUiNodes(xml: string) {
  const visibleAncestors: boolean[] = [];
  for (const tag of xml.matchAll(nodeTag)) {
    if (tag[0].startsWith("<!--")) continue;
    if (tag[0].startsWith("</")) {
      visibleAncestors.pop();
      continue;
    }
    const attributes = new Map(
      Array.from(tag[0].matchAll(attribute), ([, name, double, single]) => [
        name,
        double ?? single,
      ]),
    );
    const visible =
      visibleAncestors.at(-1) !== false &&
      attributes.get("visible-to-user") !== "false";
    if (!tag[0].endsWith("/>")) visibleAncestors.push(visible);
    if (!visible) continue;
    const bounds = attributes.get("bounds")?.match(boundsPattern);
    if (!bounds) continue;
    const [left, top, right, bottom] = bounds.slice(1).map(Number);
    if (
      !Number.isSafeInteger(right) ||
      !Number.isSafeInteger(bottom) ||
      right <= left ||
      bottom <= top
    ) {
      continue;
    }
    yield {
      bounds: { left, top, right, bottom },
      enabled: attributes.get("enabled") !== "false",
      text: decodeLabel(attributes.get("text")),
      description: decodeLabel(attributes.get("content-desc")),
      resourceId: decodeLabel(attributes.get("resource-id")),
      className: decodeLabel(attributes.get("class")),
    };
  }
}

function decodeLabel(value: string | undefined) {
  return value
    ?.replace(
      /&(amp|apos|gt|lt|quot|#\d+|#x[\da-fA-F]+);/g,
      (entity, name: string) => {
        if (!name.startsWith("#")) return xmlEntities[name];
        const codePoint = name.startsWith("#x")
          ? Number.parseInt(name.slice(2), 16)
          : Number(name.slice(1));
        return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
      },
    )
    .normalize();
}
