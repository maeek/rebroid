import { BadRequestException } from '@nestjs/common';
import {
  AutomationTag,
  DEFAULT_AUTOMATION_TAG_COLOR,
} from '@rebroid/automation-core/definition';

const hexColorPattern = /^#[0-9a-fA-F]{6}$/;

const normalizeTagName = (value: unknown, field: string) => {
  if (typeof value !== 'string') {
    throw new BadRequestException(`${field}.name must be a string.`);
  }
  const name = value.trim();
  if (!name) {
    return null;
  }
  if (name.length > 48) {
    throw new BadRequestException(
      `${field}.name must be 48 characters or fewer.`,
    );
  }
  return name;
};

const normalizeTagColor = (value: unknown, field: string) => {
  if (typeof value !== 'string') {
    throw new BadRequestException(`${field}.color must be a hex color.`);
  }
  const color = value.trim();
  if (!hexColorPattern.test(color)) {
    throw new BadRequestException(
      `${field}.color must be a #RRGGBB hex color.`,
    );
  }
  return color.toLowerCase();
};

export const normalizeAutomationTags = (value: unknown, field = 'tags') => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new BadRequestException(`${field} must be an array.`);
  }

  const seen = new Set<string>();
  const tags: AutomationTag[] = [];
  for (const rawTag of value) {
    if (!rawTag || typeof rawTag !== 'object' || Array.isArray(rawTag)) {
      throw new BadRequestException(`${field} values must be tag objects.`);
    }
    const record = rawTag as Record<string, unknown>;
    const name = normalizeTagName(record.name, field);
    if (!name) {
      continue;
    }
    const color = normalizeTagColor(record.color, field);
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      tags.push({ name, color });
    }
  }

  return tags.length > 0 ? tags : undefined;
};

const normalizeStoredAutomationTags = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const tags: AutomationTag[] = [];
  for (const rawTag of value) {
    const tag =
      typeof rawTag === 'string'
        ? { name: rawTag, color: DEFAULT_AUTOMATION_TAG_COLOR }
        : rawTag && typeof rawTag === 'object' && !Array.isArray(rawTag)
          ? rawTag
          : null;
    if (!tag) continue;

    const record = tag as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    const color =
      typeof record.color === 'string' && hexColorPattern.test(record.color)
        ? record.color.toLowerCase()
        : DEFAULT_AUTOMATION_TAG_COLOR;
    if (!name || name.length > 48) continue;

    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      tags.push({ name, color });
    }
  }
  return tags;
};

export const parseAutomationTagsJson = (value: string | null | undefined) => {
  if (!value) {
    return [];
  }
  try {
    return normalizeStoredAutomationTags(JSON.parse(value));
  } catch {
    return [];
  }
};

export const automationTagNames = (tags: AutomationTag[]) =>
  tags.map((tag) => tag.name);
