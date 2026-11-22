import type { AutomationAiProviderRemoteModel } from './contracts/ai-provider';

export const parseProviderRemoteModels = (
  body: unknown,
): AutomationAiProviderRemoteModel[] => {
  if (!isRecord(body)) return [];
  const openAi = Array.isArray(body.data);
  const rows = openAi ? body.data : body.models;
  if (!Array.isArray(rows)) return [];

  const models: AutomationAiProviderRemoteModel[] = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const model = openAi ? openAiModel(row) : ollamaModel(row);
    if (model) models.push(model);
  }
  return models;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const ollamaModel = (
  row: Record<string, unknown>,
): AutomationAiProviderRemoteModel | undefined => {
  const id = textValue(row.name) || textValue(row.model);
  if (!id) return;
  const details = isRecord(row.details) ? row.details : {};
  const family = textValue(details.family);
  const parameterSize = textValue(details.parameter_size);
  const quantizationLevel = textValue(details.quantization_level);
  return {
    id,
    label: id,
    ...(family && { family }),
    ...(parameterSize && { parameterSize }),
    ...(quantizationLevel && { quantizationLevel }),
  };
};

const openAiModel = (
  row: Record<string, unknown>,
): AutomationAiProviderRemoteModel | undefined => {
  const id = textValue(row.id);
  if (!id) return;
  const family = textValue(row.owned_by);
  const capabilities = parseCapabilityLabels(row);
  return {
    id,
    label: textValue(row.name) || id,
    ...(family && { family }),
    ...(capabilities && { capabilities }),
  };
};

const textValue = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

const parseCapabilityLabels = (model: Record<string, unknown>) => {
  const raw = Array.isArray(model.labels) ? model.labels : model.capabilities;
  if (!Array.isArray(raw)) return null;
  const labels = new Set(raw);
  const capabilities = {
    ...(labels.has('tool-calling') || labels.has('tools')
      ? { tools: true }
      : {}),
    ...(labels.has('vision') ? { vision: true } : {}),
    ...(labels.has('reasoning') ? { reasoning: true } : {}),
  };
  return Object.keys(capabilities).length > 0 ? capabilities : null;
};
