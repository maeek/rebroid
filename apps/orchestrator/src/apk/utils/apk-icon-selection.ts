import { maxIconBytes, type ZipEntry } from '../types/apk.types';
import { imageDimensions, imageMimeType } from './apk-image.utils';

interface IconCandidate {
  name: string;
  score: number;
  mimeType: string;
}

const maxCandidatesToRead = 24;
const maxDimensionBonus = 512;

function toIconCandidate(entry: ZipEntry): IconCandidate | null {
  const path = entry.name.toLowerCase();
  if (!path.startsWith('res/') || entry.uncompressedSize > maxIconBytes) {
    return null;
  }

  const mimeType = imageMimeType(path);
  if (!mimeType) {
    return null;
  }

  let score = 0;
  if (path.startsWith('res/mipmap')) score += 1000;
  if (path.startsWith('res/drawable')) score += 700;
  if (path.includes('ic_launcher')) score += 600;
  if (path.includes('launcher')) score += 350;
  if (path.includes('app_icon')) score += 180;
  if (path.includes('icon')) score += 80;
  if (path.includes('xxxhdpi')) score += 180;
  if (path.includes('xxhdpi')) score += 150;
  if (path.includes('xhdpi')) score += 120;
  if (path.includes('hdpi')) score += 90;
  if (path.includes('mdpi')) score += 50;
  if (path.includes('nodpi')) score += 30;
  if (path.includes('round')) score += 25;
  if (path.includes('foreground')) score -= 450;
  if (path.includes('background')) score -= 450;
  if (path.includes('monochrome')) score -= 700;
  if (!path.includes('launcher') && !path.includes('app_icon')) score -= 650;
  score += Math.min(entry.uncompressedSize / 1024, 128);

  return score > 0 ? { name: entry.name, score, mimeType } : null;
}

export async function selectBestIconDataUrl(
  entries: readonly ZipEntry[],
  readEntry: (name: string) => Promise<Buffer | null>,
) {
  const candidates: IconCandidate[] = [];
  for (const entry of entries) {
    const candidate = toIconCandidate(entry);
    if (!candidate) continue;
    if (candidates.length === maxCandidatesToRead) {
      if (candidate.score <= candidates[candidates.length - 1].score) continue;
      candidates.pop();
    }
    const before = candidates.findIndex(
      (other) => other.score < candidate.score,
    );
    if (before < 0) candidates.push(candidate);
    else candidates.splice(before, 0, candidate);
  }

  let best: { score: number; mimeType: string; content: Buffer } | null = null;
  for (const candidate of candidates) {
    if (best && candidate.score + maxDimensionBonus <= best.score) break;
    const content = await readEntry(candidate.name);
    if (!content || content.length === 0 || content.length > maxIconBytes) {
      continue;
    }

    const dimensions = imageDimensions(content, candidate.mimeType);
    const score =
      candidate.score +
      (dimensions
        ? Math.min(
            Math.max(dimensions.width, dimensions.height),
            maxDimensionBonus,
          )
        : 0);
    if (!best || score > best.score) {
      best = { score, mimeType: candidate.mimeType, content };
    }
  }

  return best
    ? `data:${best.mimeType};base64,${best.content.toString('base64')}`
    : null;
}
