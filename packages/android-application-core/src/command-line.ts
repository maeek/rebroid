export const parseCommandLine = (value?: string | null) => {
  if (!value?.trim()) {
    return undefined;
  }

  const args: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (const character of value.trim()) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    if (quote) {
      if (character === quote) {
        quote = null;
      } else {
        current += character;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (/\s/.test(character)) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += character;
  }

  if (current) {
    args.push(current);
  }

  return args.length > 0 ? args : undefined;
};
