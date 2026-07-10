import { Injectable } from '@nestjs/common';
import {
  androidIconAttr,
  androidLabelAttr,
  androidRoundIconAttr,
  noEntry,
  resStringPoolType,
  resXmlResourceMapType,
  resXmlStartElementType,
  typedValueReference,
  typedValueString,
} from '../types/apk.types';
import {
  readBinaryXmlResourceMap,
  readBinaryXmlStringPool,
  readChunkHeaderSize,
} from '../utils/apk-resource-table.utils';

@Injectable()
export class ApkManifestReaderService {
  readStrings(manifest: Buffer) {
    let offset = readChunkHeaderSize(manifest, 0);
    while (offset + 8 <= manifest.length) {
      const type = manifest.readUInt16LE(offset);
      const size = manifest.readUInt32LE(offset + 4);
      if (size < 8 || offset + size > manifest.length) {
        break;
      }
      if (type === resStringPoolType) {
        return readBinaryXmlStringPool(manifest, offset).strings;
      }
      offset += size;
    }
    return [];
  }

  readIconReferences(manifest: Buffer) {
    const result: {
      iconResourceId?: number;
      roundIconResourceId?: number;
      iconPath?: string;
      roundIconPath?: string;
    } = {};
    let strings: string[] = [];
    let resourceMap: number[] = [];
    let offset = readChunkHeaderSize(manifest, 0);

    while (offset + 8 <= manifest.length) {
      const type = manifest.readUInt16LE(offset);
      const size = manifest.readUInt32LE(offset + 4);
      if (size < 8 || offset + size > manifest.length) {
        break;
      }

      if (type === resStringPoolType) {
        strings = readBinaryXmlStringPool(manifest, offset).strings;
      } else if (type === resXmlResourceMapType) {
        resourceMap = readBinaryXmlResourceMap(manifest, offset, size);
      } else if (type === resXmlStartElementType && size >= 36) {
        const elementNameIndex = manifest.readUInt32LE(offset + 20);
        if (strings[elementNameIndex] === 'application') {
          const attrsStart = offset + 16 + manifest.readUInt16LE(offset + 24);
          const attrSize = manifest.readUInt16LE(offset + 26);
          const attrCount = manifest.readUInt16LE(offset + 28);
          for (let index = 0; index < attrCount; index += 1) {
            const attrOffset = attrsStart + index * attrSize;
            if (attrOffset + 20 > offset + size) {
              continue;
            }

            const nameIndex = manifest.readUInt32LE(attrOffset + 4);
            const rawValueIndex = manifest.readUInt32LE(attrOffset + 8);
            const dataType = manifest.readUInt8(attrOffset + 15);
            const data = manifest.readUInt32LE(attrOffset + 16);
            const name = strings[nameIndex];
            const resourceId = resourceMap[nameIndex];
            const isIcon = name === 'icon' || resourceId === androidIconAttr;
            const isRoundIcon =
              name === 'roundIcon' || resourceId === androidRoundIconAttr;
            if (!isIcon && !isRoundIcon) {
              continue;
            }

            const rawValue =
              rawValueIndex !== noEntry ? strings[rawValueIndex] : undefined;
            if (dataType === typedValueReference) {
              if (isIcon) result.iconResourceId = data;
              if (isRoundIcon) result.roundIconResourceId = data;
            } else if (dataType === typedValueString && rawValue) {
              if (isIcon) result.iconPath = rawValue;
              if (isRoundIcon) result.roundIconPath = rawValue;
            }
          }
        }
      }

      offset += size;
    }

    return result;
  }

  readPackageName(manifest: Buffer) {
    let strings: string[] = [];
    let offset = readChunkHeaderSize(manifest, 0);

    while (offset + 8 <= manifest.length) {
      const type = manifest.readUInt16LE(offset);
      const size = manifest.readUInt32LE(offset + 4);
      if (size < 8 || offset + size > manifest.length) {
        break;
      }

      if (type === resStringPoolType) {
        strings = readBinaryXmlStringPool(manifest, offset).strings;
      } else if (type === resXmlStartElementType && size >= 36) {
        const elementNameIndex = manifest.readUInt32LE(offset + 20);
        if (strings[elementNameIndex] === 'manifest') {
          const attrsStart = offset + 16 + manifest.readUInt16LE(offset + 24);
          const attrSize = manifest.readUInt16LE(offset + 26);
          const attrCount = manifest.readUInt16LE(offset + 28);
          for (let index = 0; index < attrCount; index += 1) {
            const attrOffset = attrsStart + index * attrSize;
            if (attrOffset + 20 > offset + size) {
              continue;
            }

            const nameIndex = manifest.readUInt32LE(attrOffset + 4);
            const rawValueIndex = manifest.readUInt32LE(attrOffset + 8);
            const dataType = manifest.readUInt8(attrOffset + 15);
            const data = manifest.readUInt32LE(attrOffset + 16);
            if (strings[nameIndex] !== 'package') {
              continue;
            }

            const rawValue =
              rawValueIndex !== noEntry ? strings[rawValueIndex] : undefined;
            const typedValue =
              dataType === typedValueString ? strings[data] : undefined;
            return rawValue || typedValue || null;
          }
        }
      }

      offset += size;
    }

    return null;
  }

  readApplicationLabel(manifest: Buffer) {
    const result: { value?: string; resourceId?: number } = {};
    let strings: string[] = [];
    let resourceMap: number[] = [];
    let offset = readChunkHeaderSize(manifest, 0);

    while (offset + 8 <= manifest.length) {
      const type = manifest.readUInt16LE(offset);
      const size = manifest.readUInt32LE(offset + 4);
      if (size < 8 || offset + size > manifest.length) {
        break;
      }

      if (type === resStringPoolType) {
        strings = readBinaryXmlStringPool(manifest, offset).strings;
      } else if (type === resXmlResourceMapType) {
        resourceMap = readBinaryXmlResourceMap(manifest, offset, size);
      } else if (type === resXmlStartElementType && size >= 36) {
        const elementNameIndex = manifest.readUInt32LE(offset + 20);
        if (strings[elementNameIndex] === 'application') {
          const attrsStart = offset + 16 + manifest.readUInt16LE(offset + 24);
          const attrSize = manifest.readUInt16LE(offset + 26);
          const attrCount = manifest.readUInt16LE(offset + 28);
          for (let index = 0; index < attrCount; index += 1) {
            const attrOffset = attrsStart + index * attrSize;
            if (attrOffset + 20 > offset + size) {
              continue;
            }

            const nameIndex = manifest.readUInt32LE(attrOffset + 4);
            const rawValueIndex = manifest.readUInt32LE(attrOffset + 8);
            const dataType = manifest.readUInt8(attrOffset + 15);
            const data = manifest.readUInt32LE(attrOffset + 16);
            const name = strings[nameIndex];
            const resourceId = resourceMap[nameIndex];
            if (name !== 'label' && resourceId !== androidLabelAttr) {
              continue;
            }

            const rawValue =
              rawValueIndex !== noEntry ? strings[rawValueIndex] : undefined;
            if (dataType === typedValueReference) {
              result.resourceId = data;
            } else if (dataType === typedValueString) {
              result.value = rawValue || strings[data];
            }
          }
        }
      }

      offset += size;
    }

    return result;
  }
}
