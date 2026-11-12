const nodeTag = /<node(?=[\s/>])(?:[^"'<>]|"[^"]*"|'[^']*')*>/g;
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

export function findUiTextTarget(
  xml: string,
  text: string,
  match: UiTextMatch,
) {
  const query = text.normalize();
  if (!query.trim()) return null;

  for (const tag of xml.matchAll(nodeTag)) {
    const attributes = new Map(
      Array.from(tag[0].matchAll(attribute), ([, name, double, single]) => [
        name,
        double ?? single,
      ]),
    );
    if (
      attributes.get("visible-to-user") === "false" ||
      attributes.get("enabled") === "false"
    ) {
      continue;
    }
    const labels = [attributes.get("text"), attributes.get("content-desc")];
    if (
      !labels.some((label) => {
        if (!label) return false;
        const decoded = decodeLabel(label);
        return match === "exact" ? decoded === query : decoded.includes(query);
      })
    ) {
      continue;
    }
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
    return {
      x: left + Math.floor((right - left) / 2),
      y: top + Math.floor((bottom - top) / 2),
    };
  }
  return null;
}

function decodeLabel(value: string) {
  return value
    .replace(
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
