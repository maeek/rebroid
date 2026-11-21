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
  type NamedBinaryXmlAttribute,
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

  readPackageName(manifest: Buffer) {
    const elements = readBinaryXmlElementAttributes(manifest, ['manifest']);
    return packageNameFromAttributes(elements.get('manifest') ?? []);
  }

  readMetadata(manifest: Buffer) {
    const elements = readBinaryXmlElementAttributes(manifest, [
      'manifest',
      'application',
    ]);
    const label: { value?: string; resourceId?: number } = {};
    const declaredIcons: {
      iconResourceId?: number;
      roundIconResourceId?: number;
      iconPath?: string;
      roundIconPath?: string;
    } = {};
    for (const attribute of elements.get('application') ?? []) {
      const { name, resourceId, dataType, data, rawValue } = attribute;
      if (name === 'label' || resourceId === androidLabelAttr) {
        if (dataType === typedValueReference) label.resourceId = data;
        else if (dataType === typedValueString) {
          label.value = rawValue || attribute.strings[data];
        }
      }

      const isIcon = name === 'icon' || resourceId === androidIconAttr;
      const isRoundIcon =
        name === 'roundIcon' || resourceId === androidRoundIconAttr;
      if (dataType === typedValueReference) {
        if (isIcon) declaredIcons.iconResourceId = data;
        if (isRoundIcon) declaredIcons.roundIconResourceId = data;
      } else if (dataType === typedValueString && rawValue) {
        if (isIcon) declaredIcons.iconPath = rawValue;
        if (isRoundIcon) declaredIcons.roundIconPath = rawValue;
      }
    }

    return {
      packageName: packageNameFromAttributes(elements.get('manifest') ?? []),
      label,
      declaredIcons,
    };
  }
}

function packageNameFromAttributes(attributes: NamedBinaryXmlAttribute[]) {
  const attribute = attributes.find(({ name }) => name === 'package');
  if (!attribute) return null;
  const typedValue =
    attribute.dataType === typedValueString
      ? attribute.strings[attribute.data]
      : undefined;
  return attribute.rawValue || typedValue || null;
}
