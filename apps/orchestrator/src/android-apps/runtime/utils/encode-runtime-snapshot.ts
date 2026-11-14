import sharp from 'sharp';
import { z } from 'zod';

const maximumSourceBytes = 12 * 1024 * 1024;
const pngDataUrlPrefix = 'data:image/png;base64,';
const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex');
const maximumDataUrlLength =
  pngDataUrlPrefix.length + (maximumSourceBytes / 3) * 4;
export const maximumSnapshotResponseBytes = maximumDataUrlLength + 1024;

const sourceSchema = z.object({
  mimeType: z.literal('image/png'),
  dataUrl: z.string().max(maximumDataUrlLength).startsWith(pngDataUrlPrefix),
  capturedAt: z.iso.datetime(),
});

export const encodeRuntimeSnapshot = async (source: unknown) => {
  const { dataUrl, capturedAt } = sourceSchema.parse(source);
  const png = Buffer.from(dataUrl.slice(pngDataUrlPrefix.length), 'base64');
  if (!png.subarray(0, pngSignature.length).equals(pngSignature)) {
    throw new Error('Snapshot capture did not return a PNG.');
  }
  const content = await sharp(png, { limitInputPixels: 16_777_216 })
    .resize(480, 480, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 65 })
    .toBuffer();
  return { capturedAt, content };
};
