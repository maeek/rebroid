import { BadRequestException } from '@nestjs/common';
import { readProviderJson } from '../common/ai-provider-http';
import { readProviderStreamFrames } from '../common/ai-provider-stream';

type DownloadProgress = {
  message: string;
  total?: number;
  completed?: number;
  percent?: number;
};

export async function downloadOllamaModel(
  endpoint: string,
  modelId: string,
  onProgress: (progress: DownloadProgress) => void,
) {
  const response = await fetch(`${endpoint}/api/pull`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(30 * 60 * 1000),
    body: JSON.stringify({ name: modelId, stream: true }),
  });
  if (!response.ok) {
    const body = (await readProviderJson(response)) as {
      error?: unknown;
      message?: unknown;
    } | null;
    const message =
      typeof body?.error === 'string'
        ? body.error
        : typeof body?.message === 'string'
          ? body.message
          : `${response.status} ${response.statusText}`;
    throw new BadRequestException(`Ollama model download failed: ${message}`);
  }
  if (!response.body) {
    throw new BadRequestException(
      'Ollama model download did not return a progress stream.',
    );
  }

  let lastEventSucceeded = false;
  for await (const line of readProviderStreamFrames(
    response.body,
    'ollama-ndjson',
  )) {
    const event = JSON.parse(line) as Record<string, unknown> | null;
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      throw new BadRequestException(
        'Ollama returned an invalid download event.',
      );
    }
    if ('error' in event) {
      const message =
        typeof event.error === 'string' && event.error.trim()
          ? event.error
          : 'Provider reported an error.';
      throw new BadRequestException(`Ollama model download failed: ${message}`);
    }
    lastEventSucceeded = event.status === 'success';
    const total = progressCount(event.total);
    const completed = progressCount(event.completed);
    onProgress({
      message:
        typeof event.status === 'string' ? event.status : 'Downloading model.',
      total,
      completed,
      percent:
        total && completed !== undefined
          ? Math.min(100, Math.round((completed / total) * 100))
          : undefined,
    });
  }
  if (!lastEventSucceeded) {
    throw new BadRequestException(
      'Ollama model download ended without confirming success.',
    );
  }
}

function progressCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}
