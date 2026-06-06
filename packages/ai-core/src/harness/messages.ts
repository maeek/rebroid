import type { ChatMessage } from "./types";
import type {
  AutomationAiProviderModel,
  AutomationAiRunInput,
} from "../provider/types";

export const buildInitialMessages = (
  input: Pick<AutomationAiRunInput, "prompt">,
  model: AutomationAiProviderModel,
): ChatMessage[] => [
  {
    role: "system",
    content: [
      "You are controlling an Android automation through typed tools. Use tools only when needed, keep progress concise, and finish with a short visible summary. Never invent tool results.",
      model.settings.systemPrompt,
    ]
      .filter(Boolean)
      .join("\n\n"),
  },
  { role: "user", content: input.prompt },
];
