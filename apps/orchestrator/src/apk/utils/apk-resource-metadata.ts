import { resTablePackageType, typedValueString } from '../types/apk.types';
import { imageMimeType } from './apk-image.utils';
import {
  readBinaryResourceChunks,
  readResourceTableHeader,
  readSimpleResourceEntries,
  scoreResourceIconPath,
} from './apk-resource-table.utils';

export function readApkResourceMetadata(
  resources: Buffer,
  labelId: number | undefined,
  iconIds: readonly number[],
) {
  let label: string | null = null;
  const icons: { entryName: string; score: number }[] = [];
  const header = readResourceTableHeader(resources);
  if (!header) return { label, icons };

  for (const chunk of readBinaryResourceChunks(
    resources,
    header.packagesOffset,
  )) {
    if (chunk.type !== resTablePackageType) continue;
    // Android label lookup uses the first matching string in each package.
    let foundLabelInPackage = false;
    for (const entry of readSimpleResourceEntries(
      resources,
      chunk.offset,
      chunk.size,
    )) {
      if (entry.dataType !== typedValueString) continue;
      if (!label && !foundLabelInPackage && entry.resourceId === labelId) {
        foundLabelInPackage = true;
        label = header.strings[entry.data] || null;
        if (label && !iconIds.length) return { label, icons };
      }
      if (!iconIds.includes(entry.resourceId)) continue;
      const entryName = header.strings[entry.data];
      if (entryName && imageMimeType(entryName.toLowerCase())) {
        icons.push({
          entryName,
          score: scoreResourceIconPath(entryName, entry.density),
        });
      }
    }
  }

  icons.sort((left, right) => right.score - left.score);
  return { label, icons };
}
