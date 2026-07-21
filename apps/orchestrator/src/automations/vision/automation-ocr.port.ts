import type { AiScreenshot } from '../ai/automation-ai-screenshot.utils';
import type { VisionDetection } from './vision-observation';

export const AUTOMATION_OCR = Symbol('AUTOMATION_OCR');

export interface AutomationOcrResult {
  status: 'available' | 'disabled' | 'failed';
  detections: VisionDetection[];
  elapsedMs?: number;
  engine?: string;
  model?: string;
  language?: string;
  preprocessingMode?: string;
  preprocessingAttempts?: OcrPreprocessingAttempt[];
  error?: string;
}

export interface OcrPreprocessingAttempt {
  mode: string;
  status: string;
  textBoxCount?: number;
  averageConfidence?: number;
  qualityScore?: number;
  elapsedMs?: number;
  error?: string;
}

export interface AutomationOcrPort {
  recognize(
    image: AiScreenshot,
    abortSignal?: AbortSignal,
  ): Promise<AutomationOcrResult>;
}
