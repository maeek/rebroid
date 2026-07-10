import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { AutomationCommandContext } from '../commands/automation-command.types';
import { optimizeAiScreenshot } from '../ai/automation-ai-screenshot.utils';
import {
  AUTOMATION_OCR,
  type AutomationOcrResult,
  type AutomationOcrPort,
} from './automation-ocr.port';

export interface AutomationVisionCapture {
  screenshot: {
    mimeType: string;
    dataUrl: string;
    capturedAt: string;
  };
  aiImage: Awaited<ReturnType<typeof optimizeAiScreenshot>>;
  ui: {
    status: 'available' | 'failed';
    xml?: string;
    error?: string;
    diagnostics?: {
      rawNodeCount: number;
    };
  };
  ocr: AutomationOcrResult;
}

@Injectable()
export class AutomationVisionCaptureService {
  constructor(
    @Inject(AUTOMATION_OCR) private readonly ocr: AutomationOcrPort,
  ) {}

  async capture(
    context: Pick<AutomationCommandContext, 'adb' | 'app' | 'abortSignal'>,
  ): Promise<AutomationVisionCapture> {
    if (context.abortSignal?.aborted) {
      throw new BadRequestException(
        'Automation vision operation was canceled.',
      );
    }

    const screenshot = await context.adb.screenshot(context.app);
    const aiImage = await optimizeAiScreenshot(screenshot);
    const uiPromise = context.adb
      .dumpUi(context.app)
      .catch((error: unknown) => ({
        status: 'failed' as const,
        error:
          error instanceof Error ? error.message : 'UI hierarchy dump failed.',
      }));
    const [ui, ocr] = await Promise.all([
      uiPromise,
      this.ocr.recognize(screenshot, context.abortSignal),
    ]);

    return { screenshot, aiImage, ui, ocr };
  }
}
