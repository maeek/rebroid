import type { AutomationAiProvider } from "./types";

export const MASKED_API_KEY = "********";

export const defaultAiProviders = (): AutomationAiProvider[] => [
  {
    id: "local-ollama",
    label: "Local Ollama",
    kind: "ollama",
    baseUrl: "http://localhost:11434",
    apiKey: null,
    models: [
      {
        id: "qwen2.5vl:7b",
        label: "Qwen 2.5 VL 7B",
        settings: {},
        supportsVision: true,
        supportsTools: true,
        enabled: true,
        default: true,
      },
      {
        id: "qwen2.5:7b",
        label: "Qwen 2.5 7B",
        settings: {},
        supportsVision: false,
        supportsTools: true,
        enabled: true,
        default: false,
      },
    ],
    enabled: false,
  },
];
