import type {
  AutomationCommandOutputMetadata,
  AutomationStepOutputRef,
} from "./definition";

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

export type AutomationCommandOutcome =
  "succeeded" | "not_found" | "unsupported" | "failed" | "uncertain";

const commandOutcomeOutput: AutomationCommandOutputMetadata = {
  key: "commandOutcome",
  label: "Command outcome",
  type: "string",
  description: "succeeded, not_found, unsupported, failed, or uncertain.",
};

export const normalizeCommandOutputs = (
  outputs: AutomationCommandOutputMetadata[] = [],
) => {
  const seen = new Set<string>();
  return [summaryOutput, commandOutcomeOutput, ...outputs].filter((output) => {
    if (seen.has(output.key)) {
      return false;
    }
    seen.add(output.key);
    return true;
  });
};

export const actionInputBindingType = (
  uses: string,
  key: string,
  property: unknown,
) => {
  if (!isRecord(property)) return undefined;
  if (uses === "ai.run" && key !== "prompt") return undefined;
  if (uses === "android.adbShell" && key === "command") return undefined;
  if (property.type === "integer") return "number";
  if (
    property.type === "number" ||
    property.type === "boolean" ||
    property.type === "string"
  ) {
    return property.type;
  }
  return undefined;
};

export const hasActionInputBinding = (
  value: unknown,
): value is Record<"$ref", unknown> =>
  isRecord(value) && Object.hasOwn(value, "$ref");

export const actionInputBinding = (
  value: unknown,
): AutomationStepOutputRef | undefined => {
  if (!hasActionInputBinding(value) || !isRecord(value.$ref)) return undefined;
  if (Object.keys(value).length !== 1 || Object.keys(value.$ref).length !== 3)
    return undefined;
  const { source, stepId, outputKey } = value.$ref;
  if (
    source !== "stepOutput" ||
    typeof stepId !== "string" ||
    typeof outputKey !== "string"
  )
    return undefined;
  if (!stepId.trim() || !outputKey.trim()) return undefined;
  return { source, stepId: stepId.trim(), outputKey: outputKey.trim() };
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
