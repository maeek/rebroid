import type { ChatMessage } from "./types";
import type {
  AutomationAiProviderModel,
  AutomationAiRunInput,
} from "../provider/types";

export const AI_AUTOMATION_MASTER_SYSTEM_PROMPT = [
  "You are an Android automation agent controlling a live device through typed tools.",
  "Always inspect the latest structured screen observation before choosing screen actions.",
  "Use only the tools provided to you. Do not invent tool results or assume an action succeeded without observing the screen again.",
  "After every screen-changing action, wait for the fresh observation before deciding the next action.",
  "Prefer semantic, vision.locate, or state-reading tools when they are available.",
  "Use normalized 0..1 coordinates for screen actions. Prefer android.tapNormalized and android.swipeNormalized over raw pixel coordinates.",
  "Continue the observe/action/observe loop until the requested task is visibly complete, the app blocks progress, or a timeout/tool limit is reached.",
  "Write concise visible progress and a short final answer. Do not reveal hidden reasoning.",
].join("\n");

export const buildInitialMessages = (
  input: Pick<
    AutomationAiRunInput,
    "prompt" | "initialScreenshotDataUrl" | "conversation"
  > & { initialUiXml?: string; initialObservationText?: string },
  model: AutomationAiProviderModel,
): ChatMessage[] => {
  const userContent = input.initialObservationText
    ? `${input.prompt}\n\nCurrent screen observation:\n${input.initialObservationText}\n\nInspect this observation before taking any action.`
    : input.initialScreenshotDataUrl
    ? [
        {
          type: "text" as const,
          text: `${input.prompt}\n\nCurrent screenshot is attached. Inspect it before taking any action.`,
        },
        {
          type: "image_url" as const,
          image_url: { url: input.initialScreenshotDataUrl },
        },
      ]
    : "initialUiXml" in input && typeof input.initialUiXml === "string"
      ? `${input.prompt}\n\nCurrent UI hierarchy XML:\n${input.initialUiXml}\n\nInspect this UI hierarchy before taking any action.`
    : input.prompt;

  const history: ChatMessage[] = (input.conversation ?? []).map((message) => ({
    role: message.role,
    content: message.content,
  }));

  return [
    {
      role: "system",
      content: [AI_AUTOMATION_MASTER_SYSTEM_PROMPT, model.settings.systemPrompt]
        .filter(Boolean)
        .join("\n\n"),
    },
    ...history,
    { role: "user", content: userContent },
  ];
};

export const buildScreenObservationMessage = ({
  summary,
  observation,
}: {
  summary: string;
  observation: string;
}): ChatMessage => ({
  role: "user",
  content: `${summary}\n\nCurrent screen observation:\n${observation}\n\nInspect this latest observation before deciding the next step.`,
});

export const buildScreenshotObservationMessage = ({
  dataUrl,
  summary,
}: {
  dataUrl: string;
  summary: string;
}): ChatMessage => ({
  role: "user",
  content: [
    {
      type: "text",
      text: `${summary} Inspect this latest screenshot before deciding the next step.`,
    },
    {
      type: "image_url",
      image_url: { url: dataUrl },
    },
  ],
});

export const buildUiXmlObservationMessage = ({
  summary,
  xml,
}: {
  summary: string;
  xml: string;
}): ChatMessage => ({
  role: "user",
  content: `${summary}\n\nCurrent UI hierarchy XML:\n${xml}\n\nInspect this latest UI hierarchy before deciding the next step.`,
});
