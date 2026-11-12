import { join } from 'node:path';

export const gappsTemporaryPackageDirectory = (uploadsDir: string) =>
  join(uploadsDir, 'image-build-gapps-cache', 'temporary');

export const gappsWorkDirectory = (uploadsDir: string) =>
  join(uploadsDir, 'image-build-gapps-work');
