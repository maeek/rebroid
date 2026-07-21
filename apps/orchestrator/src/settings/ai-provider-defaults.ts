import type { AutomationAiProvider } from './contracts/ai-provider';

export const MASKED_API_KEY = '********';

export const defaultAiProviders = (): AutomationAiProvider[] => [
  {
    id: 'local-ollama',
    label: 'Local Ollama',
    kind: 'ollama',
    protocol: 'openai-chat-completions',
    serverFlavor: 'auto',
    baseUrl: 'http://localhost:11434',
    apiKey: null,
    models: [],
    enabled: false,
  },
];
