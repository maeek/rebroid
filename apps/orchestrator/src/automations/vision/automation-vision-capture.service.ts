import { Inject, Injectable } from '@nestjs/common';
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
    context: Pick<
      AutomationCommandContext,
      'adb' | 'app' | 'abortSignal' | 'recordOcrExchange' | 'withTarget'
    >,
    deadline?: number,
  ): Promise<AutomationVisionCapture> {
    const { abortSignal, adb, withTarget, recordOcrExchange } = context;
    abortSignal?.throwIfAborted();
    const readScreen = async (app: AutomationCommandContext['app']) => {
      const screenshot = await adb.screenshot(app, abortSignal);
      abortSignal?.throwIfAborted();
      const ui = await adb.dumpUi(app, abortSignal).catch((error: unknown) => ({
        status: 'failed' as const,
        error:
          error instanceof Error ? error.message : 'UI hierarchy dump failed.',
      }));
      return { screenshot, ui };
    };
    const { screenshot, ui } = await (withTarget
      ? withTarget(abortSignal, readScreen)
      : readScreen(context.app));
    abortSignal?.throwIfAborted();
    const [aiImage, { result: ocr, trace }] = await Promise.all([
      optimizeAiScreenshot(screenshot),
      this.ocr.recognize(screenshot, abortSignal, deadline),
    ]);
    if (trace) recordOcrExchange?.(ocr, trace, screenshot);
    abortSignal?.throwIfAborted();
    return { screenshot, aiImage, ui, ocr };
  }
}
