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
    content[0] === 0x89 &&
    content.toString('ascii', 1, 4) === 'PNG'
  ) {
    return {
      width: content.readUInt32BE(16),
      height: content.readUInt32BE(20),
    };
  }

  if (
    mimeType === 'image/webp' &&
    content.length >= 30 &&
    content.toString('ascii', 0, 4) === 'RIFF'
  ) {
    const chunkType = content.toString('ascii', 12, 16);
    if (chunkType === 'VP8X' && content.length >= 30) {
      return {
        width: 1 + content.readUIntLE(24, 3),
        height: 1 + content.readUIntLE(27, 3),
      };
    }
    if (chunkType === 'VP8 ' && content.length >= 30) {
      return {
        width: content.readUInt16LE(26) & 0x3fff,
        height: content.readUInt16LE(28) & 0x3fff,
      };
    }
    if (chunkType === 'VP8L' && content.length >= 25) {
      const bits = content.readUInt32LE(21);
      return {
        width: 1 + (bits & 0x3fff),
        height: 1 + ((bits >> 14) & 0x3fff),
      };
    }
  }

  return null;
};