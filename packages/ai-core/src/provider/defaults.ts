import type { AutomationAiProvider } from "./types";

export const MASKED_API_KEY = "********";

export const defaultAiProviders = (): AutomationAiProvider[] => [
  {
    id: "local-ollama",
    label: "Local Ollama",
    kind: "ollama",
    baseUrl: "http://localhost:11434",
    apiKey: null,
    models: [],
    enabled: false,
  },
];
