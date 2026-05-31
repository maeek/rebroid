export const shortDockerId = (id: string) =>
  id.replace(/^sha256:/, '').slice(0, 12);

const managedImageRepository = 'rebroid.local/managed';

export const managedImageTag = (imageId: string) =>
  `${managedImageRepository}:${shortDockerId(imageId)}`;

export const isManagedImageTag = (tag: string) =>
  tag.startsWith(`${managedImageRepository}:`);

export const isString = (value: string | undefined): value is string =>
  typeof value === 'string' && value.length > 0;

export const parseCommandLine = (value?: string | null) => {
  if (!value?.trim()) {
    return undefined;
  }

  const args: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (const character of value.trim()) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }

    if (character === '\\') {
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
        current = '';
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
