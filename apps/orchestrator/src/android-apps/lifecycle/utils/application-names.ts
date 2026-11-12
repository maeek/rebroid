import { BadRequestException, ConflictException } from '@nestjs/common';

export const appNameKey = (name: string) => name.trim().toLowerCase();

export const assertAppNameAvailable = (
  name: string,
  names: ReadonlySet<string>,
) => {
  if (name.length < 2) {
    throw new BadRequestException({
      fields: ['name'],
      message: 'Enter a name with at least 2 characters.',
    });
  }
  if (names.has(appNameKey(name))) {
    throw new ConflictException({
      code: 'application_name_taken',
      fields: ['name'],
      message: 'This owner already has an app with that name.',
    });
  }
};

export const availableCloneName = (
  source: string,
  names: ReadonlySet<string>,
) => {
  const name = source.trim();
  if (name.length >= 2 && !names.has(appNameKey(name))) return name;

  const copy = name ? `${name} copy` : 'App copy';
  let candidate = copy;
  for (let number = 2; names.has(appNameKey(candidate)); number += 1) {
    candidate = `${copy} ${number}`;
  }
  return candidate;
};
