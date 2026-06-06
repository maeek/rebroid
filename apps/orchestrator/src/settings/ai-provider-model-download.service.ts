import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  modelLikelySupportsVision,
  normalizeAiModel,
  normalizeDefaultModel,
  text,
} from './ai-provider-settings';
import { AiProviderHealthService } from './ai-provider-health.service';
import { OrchestratorSettingsStore } from './orchestrator-settings-store';
import type { AutomationAiProviderModelDownloadDto } from './dto/automation-ai-provider.dto';

type AutomationAiProviderModelDownloadJob =
  AutomationAiProviderModelDownloadDto;

@Injectable()
export class AiProviderModelDownloadService {
  private readonly modelDownloads = new Map<
    string,
    AutomationAiProviderModelDownloadJob
  >();

  constructor(
    private readonly store: OrchestratorSettingsStore,
    private readonly health: AiProviderHealthService,
  ) {}

  async download(providerId: string, modelId: string, label?: string) {
    const settings = await this.store.getStoredSettings();
    const index = settings.aiProviders.findIndex(
      (provider) => provider.id === providerId,
    );
    if (index < 0) {
      throw new NotFoundException(`AI provider "${providerId}" was not found.`);
    }
    const provider = settings.aiProviders[index];
    if (provider.kind !== 'ollama') {
      throw new BadRequestException(
        'Only Ollama providers support model downloads.',
      );
    }
    const id = text(modelId);
    if (!id) {
      throw new BadRequestException('Model ID is required.');
    }
    const existingJob = Array.from(this.modelDownloads.values()).find(
      (job) =>
        job.providerId === providerId &&
        job.modelId === id &&
        ['queued', 'running'].includes(job.status),
    );
    if (existingJob) {
      return existingJob;
    }

    const now = new Date().toISOString();
    const job: AutomationAiProviderModelDownloadJob = {
      id: randomUUID(),
      providerId,
      modelId: id,
      ...(text(label) ? { label: text(label) } : {}),
      status: 'queued',
      message: 'Queued model download.',
      total: null,
      completed: null,
      percent: null,
      createdAt: now,
      updatedAt: now,
      finishedAt: null,
    };
    this.modelDownloads.set(job.id, job);
    void this.runDownload(job.id);
    return job;
  }

  get(providerId: string, downloadId: string) {
    const job = this.modelDownloads.get(downloadId);
    if (!job || job.providerId !== providerId) {
      throw new NotFoundException(
        `AI model download "${downloadId}" was not found.`,
      );
    }
    return job;
  }

  private async runDownload(downloadId: string) {
    const job = this.modelDownloads.get(downloadId);
    if (!job) {
      return;
    }

    try {
      this.updateDownload(downloadId, {
        status: 'running',
        message: 'Starting Ollama model download.',
      });
      const settings = await this.store.getStoredSettings();
      const provider = settings.aiProviders.find(
        (item) => item.id === job.providerId,
      );
      if (!provider) {
        throw new NotFoundException(
          `AI provider "${job.providerId}" was not found.`,
        );
      }
      if (provider.kind !== 'ollama') {
        throw new BadRequestException(
          'Only Ollama providers support model downloads.',
        );
      }

      const response = await fetch(
        `${provider.baseUrl.replace(/\/+$/, '')}/api/pull`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: AbortSignal.timeout(30 * 60 * 1000),
          body: JSON.stringify({ name: job.modelId, stream: true }),
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: unknown;
          message?: unknown;
        } | null;
        const message =
          typeof body?.error === 'string'
            ? body.error
            : typeof body?.message === 'string'
              ? body.message
              : `${response.status} ${response.statusText}`;
        throw new BadRequestException(
          `Ollama model download failed: ${message}`,
        );
      }
      if (!response.body) {
        throw new BadRequestException(
          'Ollama model download did not return a progress stream.',
        );
      }

      await this.readOllamaPullProgress(downloadId, response.body);
      await this.addDownloadedModel(job.providerId, job.modelId, job.label);
      this.updateDownload(downloadId, {
        status: 'completed',
        message: `Model "${job.modelId}" is downloaded.`,
        completed: null,
        total: null,
        percent: 100,
        finishedAt: new Date().toISOString(),
      });
    } catch (error) {
      this.updateDownload(downloadId, {
        status: 'failed',
        message: this.health.errorMessage(error),
        finishedAt: new Date().toISOString(),
      });
    }
  }

  private async readOllamaPullProgress(
    downloadId: string,
    body: ReadableStream<Uint8Array>,
  ) {
    const decoder = new TextDecoder();
    const reader = body.getReader();
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          this.updateDownloadFromOllamaEvent(downloadId, line);
        }
      }
      const final = `${buffer}${decoder.decode()}`.trim();
      if (final) {
        this.updateDownloadFromOllamaEvent(downloadId, final);
      }
    } finally {
      reader.releaseLock();
    }
  }

  private updateDownloadFromOllamaEvent(downloadId: string, line: string) {
    const event = JSON.parse(line) as {
      completed?: unknown;
      status?: unknown;
      total?: unknown;
    };
    const total = typeof event.total === 'number' ? event.total : null;
    const completed =
      typeof event.completed === 'number' ? event.completed : null;
    const percent =
      total && completed !== null
        ? Math.min(100, Math.max(0, Math.round((completed / total) * 100)))
        : null;
    this.updateDownload(downloadId, {
      message:
        typeof event.status === 'string' ? event.status : 'Downloading model.',
      ...(total !== null ? { total } : {}),
      ...(completed !== null ? { completed } : {}),
      ...(percent !== null ? { percent } : {}),
    });
  }

  private updateDownload(
    downloadId: string,
    patch: Partial<AutomationAiProviderModelDownloadJob>,
  ) {
    const current = this.modelDownloads.get(downloadId);
    if (!current) {
      return;
    }
    this.modelDownloads.set(downloadId, {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  }

  private async addDownloadedModel(
    providerId: string,
    modelId: string,
    label?: string,
  ) {
    const settings = await this.store.getStoredSettings();
    const index = settings.aiProviders.findIndex(
      (provider) => provider.id === providerId,
    );
    if (index < 0) {
      throw new NotFoundException(`AI provider "${providerId}" was not found.`);
    }
    const provider = settings.aiProviders[index];
    const existingIndex = provider.models.findIndex(
      (model) => model.id === modelId,
    );
    const nextModel = normalizeAiModel({
      ...(existingIndex >= 0 ? provider.models[existingIndex] : {}),
      id: modelId,
      label: text(label) || provider.models[existingIndex]?.label || modelId,
      supportsVision: modelLikelySupportsVision(modelId, label),
      supportsTools: true,
      enabled: true,
      default: provider.models.length === 0,
      settings: provider.models[existingIndex]?.settings ?? {},
    });
    const nextModels = [...provider.models];
    if (existingIndex >= 0) nextModels[existingIndex] = nextModel;
    else nextModels.push(nextModel);

    settings.aiProviders[index] = {
      ...provider,
      models: normalizeDefaultModel(nextModels),
    };
    await this.store.writeSettings(settings);
  }
}
