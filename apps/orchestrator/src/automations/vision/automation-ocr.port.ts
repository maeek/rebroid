import type {
  OcrPreprocessingAttempt,
  OcrSidecarTrace,
} from '../../ocr-sidecar/ocr-sidecar.protocol';
import type { AiScreenshot } from '../ai/automation-ai-screenshot.utils';
import type { VisionDetection } from './vision-observation';

export const AUTOMATION_OCR = Symbol('AUTOMATION_OCR');

export interface AutomationOcrResult {
  status: 'available' | 'disabled' | 'failed';
  detections: VisionDetection[];
  searchComplete?: boolean;
  elapsedMs?: number;
  engine?: string;
  model?: string;
  language?: string;
  preprocessingMode?: string;
  preprocessingAttempts?: OcrPreprocessingAttempt[];
  error?: string;
}

export interface AutomationOcrReading {
  result: AutomationOcrResult;
  trace?: OcrSidecarTrace;
}

export type AutomationOcrExchangeRecorder = (
  result: AutomationOcrResult,
  trace: OcrSidecarTrace,
  image: AiScreenshot,
) => void;

export interface AutomationOcrPort {
  recognize(
    image: AiScreenshot,
    abortSignal?: AbortSignal,
    deadline?: number,
  ): Promise<AutomationOcrReading>;
}
