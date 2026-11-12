import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { AutomationCommandContext } from '../commands/automation-command.types';
import { optimizeAiScreenshot } from '../ai/automation-ai-screenshot.utils';
import {
  createOcrInputPreview,
  type AutomationOcrExchange,
} from './automation-ocr-exchange';
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
      'adb' | 'app' | 'abortSignal' | 'recordOcrExchange'
    >,
    deadline?: number,
  ): Promise<AutomationVisionCapture> {
    if (context.abortSignal?.aborted) {
      throw new BadRequestException(
        'Automation vision operation was canceled.',
      );
    }

    const screenshot = await context.adb.screenshot(
      context.app,
      context.abortSignal,
    );
    context.abortSignal?.throwIfAborted();
    const uiPromise = context.adb
      .dumpUi(context.app, context.abortSignal)
      .catch((error: unknown) => ({
        status: 'failed' as const,
        error:
          error instanceof Error ? error.message : 'UI hierarchy dump failed.',
      }));
    const { recordOcrExchange } = context;
    const onExchange = recordOcrExchange
      ? async (exchange: AutomationOcrExchange) =>
          recordOcrExchange(exchange, await createOcrInputPreview(screenshot))
      : undefined;
    const [aiImage, ui, ocr] = await Promise.all([
      optimizeAiScreenshot(screenshot),
      uiPromise,
      this.ocr.recognize(screenshot, context.abortSignal, deadline, onExchange),
    ]);

    context.abortSignal?.throwIfAborted();
    return { screenshot, aiImage, ui, ocr };
  }
}
