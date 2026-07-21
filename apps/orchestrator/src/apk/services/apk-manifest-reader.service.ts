import { Injectable } from '@nestjs/common';
import {
  androidIconAttr,
  androidLabelAttr,
  androidRoundIconAttr,
  resStringPoolType,
  typedValueReference,
  typedValueString,
} from '../types/apk.types';
import {
  readBinaryResourceChunks,
  readBinaryXmlElementAttributes,
  readBinaryXmlStringPool,
} from '../utils/apk-resource-table.utils';

@Injectable()
export class ApkManifestReaderService {
  readStrings(manifest: Buffer) {
    for (const chunk of readBinaryResourceChunks(manifest)) {
      if (chunk.type === resStringPoolType) {
        return readBinaryXmlStringPool(manifest, chunk.offset).strings;
      }
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
    for (const attribute of readBinaryXmlElementAttributes(
      manifest,
      'application',
    )) {
      const isIcon =
        attribute.name === 'icon' || attribute.resourceId === androidIconAttr;
      const isRoundIcon =
        attribute.name === 'roundIcon' ||
        attribute.resourceId === androidRoundIconAttr;
      if (!isIcon && !isRoundIcon) continue;

      if (attribute.dataType === typedValueReference) {
        if (isIcon) result.iconResourceId = attribute.data;
        if (isRoundIcon) result.roundIconResourceId = attribute.data;
      } else if (
        attribute.dataType === typedValueString &&
        attribute.rawValue
      ) {
        if (isIcon) result.iconPath = attribute.rawValue;
        if (isRoundIcon) result.roundIconPath = attribute.rawValue;
      }
    }

    return result;
  }

  readPackageName(manifest: Buffer) {
    for (const attribute of readBinaryXmlElementAttributes(
      manifest,
      'manifest',
    )) {
      if (attribute.name !== 'package') continue;
      const typedValue =
        attribute.dataType === typedValueString
          ? attribute.strings[attribute.data]
          : undefined;
      return attribute.rawValue || typedValue || null;
    }

    return null;
  }

  readApplicationLabel(manifest: Buffer) {
    const result: { value?: string; resourceId?: number } = {};
    for (const attribute of readBinaryXmlElementAttributes(
      manifest,
      'application',
    )) {
      if (
        attribute.name !== 'label' &&
        attribute.resourceId !== androidLabelAttr
      ) {
        continue;
      }
      if (attribute.dataType === typedValueReference) {
        result.resourceId = attribute.data;
      } else if (attribute.dataType === typedValueString) {
        result.value = attribute.rawValue || attribute.strings[attribute.data];
      }
    }

    return result;
  }
}
