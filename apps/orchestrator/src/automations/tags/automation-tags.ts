import { BadRequestException } from '@nestjs/common';

export const normalizeAutomationTags = (value: unknown, field = 'tags') => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new BadRequestException(`${field} must be an array.`);
  }

  const seen = new Set<string>();
  const tags: string[] = [];
  for (const rawTag of value) {
    if (typeof rawTag !== 'string') {
      throw new BadRequestException(`${field} values must be strings.`);
    }
    const tag = rawTag.trim();
    if (!tag) {
      continue;
    }
    if (tag.length > 48) {
      throw new BadRequestException(
        `${field} values must be 48 characters or fewer.`,
      );
    }
    const key = tag.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      tags.push(tag);
    }
  }

  return tags.length > 0 ? tags : undefined;
};

export const parseAutomationTagsJson = (value: string | null | undefined) => {
  if (!value) {
    return [];
  }
  try {
    return normalizeAutomationTags(JSON.parse(value), 'tags') ?? [];
  } catch {
    return [];
  }
};
