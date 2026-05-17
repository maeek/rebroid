export interface ZipEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

export interface IconCandidate {
  entry: ZipEntry;
  score: number;
  mimeType: string;
}

export interface ResourceIconCandidate {
  entryName: string;
  score: number;
  mimeType: string;
}

export interface ParsedStringPool {
  strings: string[];
}

export const eocdSignature = 0x06054b50;
export const centralFileHeaderSignature = 0x02014b50;
export const localFileHeaderSignature = 0x04034b50;
export const maxIconBytes = 512 * 1024;
export const maxCandidatesToRead = 24;
export const resStringPoolType = 0x0001;
export const resTableType = 0x0002;
export const resXmlResourceMapType = 0x0180;
export const resXmlStartElementType = 0x0102;
export const resTablePackageType = 0x0200;
export const resTableTypeType = 0x0201;
export const typedValueReference = 0x01;
export const typedValueString = 0x03;
export const androidIconAttr = 0x01010002;
export const androidRoundIconAttr = 0x0101052c;
export const noEntry = 0xffffffff;