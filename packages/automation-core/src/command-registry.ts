import type { AutomationCommandOutputMetadata } from "./definition";

export type { AutomationCommandOutputMetadata } from "./definition";

export interface AutomationCommandEditorMetadata {
  inputDefaults: Record<string, unknown>;
  inputFieldOrder: string[];
  yamlSnippetFields: string[];
  category?: string;
  iconKey?: string;
  examples?: {
    label: string;
    input: Record<string, unknown>;
  }[];
}

export type AutomationCommandEditorMetadataOverride =
  Partial<AutomationCommandEditorMetadata>;

export const summaryOutput: AutomationCommandOutputMetadata = {
  key: "summary",
  label: "Summary",
  type: "string",
  description: "Human-readable step result summary.",
};

export const normalizeCommandOutputs = (
  outputs: AutomationCommandOutputMetadata[] = [],
) => {
  const seen = new Set<string>();
  return [summaryOutput, ...outputs].filter((output) => {
    if (seen.has(output.key)) {
      return false;
    }
    seen.add(output.key);
    return true;
  });
};

export const buildCommandEditorMetadata = (
  inputSchema: Record<string, unknown>,
  override?: AutomationCommandEditorMetadataOverride,
): AutomationCommandEditorMetadata => {
  const properties = propertiesOf(inputSchema);
  const derivedFieldOrder = Object.keys(properties);
  const inputDefaults = {
    ...defaultsOf(properties),
    ...(override?.inputDefaults ?? {}),
  };
  const inputFieldOrder = override?.inputFieldOrder ?? derivedFieldOrder;
  const requiredFields = new Set(requiredPropertiesOf(inputSchema));
  const yamlSnippetFields =
    override?.yamlSnippetFields ??
    inputFieldOrder.filter(
      (fieldName: string) =>
        requiredFields.has(fieldName) ||
        Object.prototype.hasOwnProperty.call(inputDefaults, fieldName),
    );

  return {
    inputDefaults,
    inputFieldOrder,
    yamlSnippetFields,
    ...(override?.category ? { category: override.category } : {}),
    ...(override?.iconKey ? { iconKey: override.iconKey } : {}),
    ...(override?.examples ? { examples: override.examples } : {}),
  };
};

const propertiesOf = (schema: Record<string, unknown>) => {
  if (!isRecord(schema.properties)) return {};
  return schema.properties as Record<string, Record<string, unknown>>;
};

const defaultsOf = (properties: Record<string, Record<string, unknown>>) =>
  Object.fromEntries(
    Object.entries(properties)
      .filter(([, propertySchema]) =>
        Object.prototype.hasOwnProperty.call(propertySchema, "default"),
      )
      .map(([propertyName, propertySchema]) => [
        propertyName,
        propertySchema.default,
      ]),
  );

const requiredPropertiesOf = (schema: Record<string, unknown>) =>
  Array.isArray(schema.required)
    ? schema.required.filter(
        (field): field is string => typeof field === "string",
      )
    : [];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
