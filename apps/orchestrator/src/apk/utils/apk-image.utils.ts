import { maxIconBytes } from '../types/apk.types';

const pngHeader = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

export const imageMimeType = (path: string) => {
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  return null;
};

export const imageDimensions = (content: Buffer, mimeType: string) => {
  if (
    mimeType === 'image/png' &&
    content.length >= 24 &&
    content.subarray(0, pngHeader.length).equals(pngHeader)
  ) {
    return {
      width: content.readUInt32BE(16),
      height: content.readUInt32BE(20),
    };
  }

  if (
    mimeType === 'image/webp' &&
    content.toString('latin1', 0, 4) === 'RIFF' &&
    content.toString('latin1', 8, 12) === 'WEBP'
  ) {
    const chunkType = content.toString('latin1', 12, 16);
    if (chunkType === 'VP8X' && content.length >= 30) {
      return {
        width: 1 + content.readUIntLE(24, 3),
        height: 1 + content.readUIntLE(27, 3),
      };
    }
    if (
      chunkType === 'VP8 ' &&
      content.length >= 30 &&
      content.readUIntBE(23, 3) === 0x9d012a
    ) {
      return {
        width: content.readUInt16LE(26) & 0x3fff,
        height: content.readUInt16LE(28) & 0x3fff,
      };
    }
    if (chunkType === 'VP8L' && content.length >= 25 && content[20] === 0x2f) {
      const bits = content.readUInt32LE(21);
      return {
        width: 1 + (bits & 0x3fff),
        height: 1 + ((bits >> 14) & 0x3fff),
      };
    }
  }

  return null;
};

export const launcherIconDataUrl = (
  path: string,
  content: Buffer,
  score: number,
) => {
  const mimeType = imageMimeType(path.toLowerCase());
  if (!mimeType || content.length === 0 || content.length > maxIconBytes) {
    return null;
  }
  const dimensions = imageDimensions(content, mimeType);
  if (
    score < 10_000 &&
    dimensions &&
    (dimensions.width < 24 || dimensions.height < 24)
  ) {
    return null;
  }
  return `data:${mimeType};base64,${content.toString('base64')}`;
};

export const normalizeApkDisplayName = (value: string) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized.slice(0, 120) : null;
};
