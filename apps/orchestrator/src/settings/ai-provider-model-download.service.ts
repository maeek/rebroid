import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  normalizeAiModel,
  normalizeDefaultModel,
  text,
} from './ai-provider-settings';
import { replaceAiProvider, requireAiProvider } from './ai-provider-catalog';
import {
  aiProviderErrorMessage,
  providerDiagnosticMessage,
} from './utils/ai-provider-health.utils';
import { OrchestratorSettingsStore } from './orchestrator-settings-store';
import type { AutomationAiProviderModelDownloadDto } from './dto/automation-ai-provider-download.dto';
import { downloadOllamaModel } from './ollama-model-download';

type ActiveDownload = {
  endpoint: string;
  job: AutomationAiProviderModelDownloadDto;
};

const maxFinishedDownloads = 128;
const normalizeEndpoint = (baseUrl: string) => baseUrl.replace(/\/+$/, '');

@Injectable()
export class AiProviderModelDownloadService {
  private readonly active = new Map<string, ActiveDownload>();
  private readonly finished = new Map<
    string,
    AutomationAiProviderModelDownloadDto
  >();

  constructor(private readonly store: OrchestratorSettingsStore) {}

  async download(providerId: string, modelId: string, label?: string) {
    const settings = await this.store.getStoredSettings();
    const provider = requireAiProvider(settings, providerId);
    if (provider.kind !== 'ollama') {
      throw new BadRequestException(
        'Only Ollama providers support model downloads.',
      );
    }
    const id = text(modelId);
    if (!id) {
      throw new BadRequestException('Model ID is required.');
    }
    const endpoint = normalizeEndpoint(provider.baseUrl);
    const existing = [...this.active.values()].find(
      (download) =>
        download.endpoint === endpoint &&
        download.job.providerId === providerId &&
        download.job.modelId === id,
    );
    if (existing) {
      return { ...existing.job };
    }

    const now = new Date().toISOString();
    const job: AutomationAiProviderModelDownloadDto = {
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
    const download = { endpoint, job };
    this.active.set(job.id, download);
    const acknowledgement = { ...job };
    void this.runDownload(download, provider.apiKey ?? null);
    return acknowledgement;
  }

  listActive(providerId: string) {
    return [...this.active.values()]
      .filter(({ job }) => job.providerId === providerId)
      .map(({ job }) => ({ ...job }));
  }

  get(providerId: string, downloadId: string) {
    const job =
      this.active.get(downloadId)?.job ?? this.finished.get(downloadId);
    if (!job || job.providerId !== providerId) {
      throw new NotFoundException(
        `AI model download "${downloadId}" was not found.`,
      );
    }
    return { ...job };
  }

  private async runDownload(
    { job, endpoint }: ActiveDownload,
    apiKey: string | null,
  ) {
    this.updateDownload(job, {
      status: 'running',
      message: 'Starting Ollama model download.',
    });
    try {
      await downloadOllamaModel(
        endpoint,
        job.modelId,
        apiKey,
        ({ message, total, completed, percent }) => {
          this.updateDownload(job, {
            message: providerDiagnosticMessage(message, apiKey).slice(0, 500),
            ...(total === undefined ? {} : { total }),
            ...(completed === undefined ? {} : { completed }),
            ...(percent === undefined ? {} : { percent }),
          });
        },
      );
      await this.addDownloadedModel(
        job.providerId,
        endpoint,
        job.modelId,
        job.label,
      );
      this.updateDownload(job, {
        status: 'completed',
        message: `Model "${job.modelId}" is downloaded.`,
        completed: null,
        total: null,
        percent: 100,
        finishedAt: new Date().toISOString(),
      });
    } catch (error) {
      this.updateDownload(job, {
        status: 'failed',
        message: providerDiagnosticMessage(
          aiProviderErrorMessage(error),
          apiKey,
        ).slice(0, 500),
        finishedAt: new Date().toISOString(),
      });
    } finally {
      this.finished.set(job.id, job);
      this.active.delete(job.id);
      if (this.finished.size > maxFinishedDownloads) {
        const oldest = this.finished.keys().next();
        if (!oldest.done) this.finished.delete(oldest.value);
      }
    }
  }

  private updateDownload(
    job: AutomationAiProviderModelDownloadDto,
    patch: Partial<AutomationAiProviderModelDownloadDto>,
  ) {
    Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  }

  private async addDownloadedModel(
    providerId: string,
    endpoint: string,
    modelId: string,
    label?: string,
  ) {
    await this.store.updateSettings((settings) =>
      replaceAiProvider(settings, providerId, (provider) => {
        if (
          provider.kind !== 'ollama' ||
          normalizeEndpoint(provider.baseUrl) !== endpoint
        ) {
          throw new ConflictException(
            'The AI provider connection changed during the model download.',
          );
        }
        const existingIndex = provider.models.findIndex(
          (model) => model.id === modelId,
        );
        const nextModel = normalizeAiModel({
          ...(existingIndex >= 0 ? provider.models[existingIndex] : {}),
          id: modelId,
          label:
            text(label) || provider.models[existingIndex]?.label || modelId,
          enabled: true,
          settings: provider.models[existingIndex]?.settings ?? {},
        });
        const nextModels = [...provider.models];
        if (existingIndex >= 0) nextModels[existingIndex] = nextModel;
        else nextModels.push(nextModel);
        return { ...provider, models: normalizeDefaultModel(nextModels) };
      }),
    );
  }
}
