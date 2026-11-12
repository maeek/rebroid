import { Injectable } from '@nestjs/common';
import { OcrSidecarService } from '../../ocr-sidecar/ocr-sidecar.service';
import { readOcrAttempts } from '../../ocr-sidecar/ocr-sidecar.protocol';
import type { AiScreenshot } from '../ai/automation-ai-screenshot.utils';
import type {
  AutomationOcrPort,
  AutomationOcrReading,
} from './automation-ocr.port';
import { createDetection } from './vision-observation';

@Injectable()
export class AutomationOcrService implements AutomationOcrPort {
  constructor(private readonly sidecar: OcrSidecarService) {}

  async recognize(
    image: AiScreenshot,
    signal?: AbortSignal,
    deadline?: number,
  ): Promise<AutomationOcrReading> {
    const response = await this.sidecar.recognize(
      image.dataUrl,
      signal,
      deadline,
    );
    if (response.status === 'disabled')
      return { result: { status: 'disabled', detections: [] } };
    if (response.status === 'failed') {
      return {
        result: {
          status: 'failed',
          detections: [],
          error: response.error,
          preprocessingAttempts: response.attempts,
        },
        trace: response.trace,
      };
    }
    const { detections, preprocessingAttempts, searchComplete, ...details } =
      response.value;
    const attempts = readOcrAttempts(preprocessingAttempts);
    return {
      result: {
        ...details,
        searchComplete:
          searchComplete !== false &&
          !attempts.some((attempt) => attempt.status === 'failed'),
        detections: detections.map((detection, index) =>
          createDetection({
            id: detection.id ?? `ocr-${index + 1}`,
            label: detection.label ?? detection.text,
            text: detection.text ?? detection.label,
            confidence: detection.confidence ?? 0.5,
            bounds: detection.bounds,
            source: 'ocr',
          }),
        ),
        ...(preprocessingAttempts === undefined
          ? {}
          : {
              preprocessingAttempts: attempts,
            }),
      },
      trace: response.trace,
    };
  }
}
