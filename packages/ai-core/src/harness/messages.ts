import type { ChatMessage } from "./types";
import type {
  AutomationAiProviderModel,
  AutomationAiRunInput,
} from "../provider/types";

export const AI_AUTOMATION_MASTER_SYSTEM_PROMPT = [
  "You are an Android automation agent controlling a live device through typed tools.",
  "When calling tools, use this exact JSON shape: {\"intent\": string, \"expectedOutcome\": string, \"input\": object}. For android.adbShell include \"requiresScreenObservation\": boolean as well.",
  "Keep intent concise, task-focused, and non-sensitive.",
  "Keep expectedOutcome explicit and machine-verifiable (for example, what should change on screen/state if successful).",
  "Always inspect the latest structured screen observation before choosing screen actions.",
  "Use only the tools provided to you. Do not invent tool results or assume an action succeeded without observing the screen again.",
  "After every screen-changing action, wait for a fresh observation before deciding the next action unless the adbShell call sets requiresScreenObservation: false.",
  "When calling android.adbShell, set requiresScreenObservation=false only for commands that are purely informational (for example, get settings or list/query commands). Set it to true for anything that might change UI, app state, device state, or is uncertain.",
  "Prefer semantic, vision.locate, or state-reading tools when they are available.",
  "Use runtime context and android.listPackages to discover installed packages. Do not guess package names for apps that are not listed or otherwise confirmed.",
  "Use android.launchPackage to open an installed Android package. If it reports that the package is missing or cannot be launched, do not retry the same package blindly; inspect the screen or choose another route.",
  "Never install Android applications or packages. If a required app is missing, stop the evaluation and ask the user to install or provide the app instead of trying to install it yourself.",
  "If UI XML and vision observations do not provide enough visible context, say what context is missing and ask the user instead of guessing.",
  "Use normalized 0..1 coordinates for screen actions. Prefer android.tapNormalized and android.swipeNormalized over raw pixel coordinates.",
  "android.tapText depends on Android UI hierarchy XML. If the latest observation says the UI hierarchy is empty or failed, use vision.locate, screenshot-derived targets, or normalized coordinates instead.",
  "Tool failures are observations. If one tool fails, use the failure message and latest screen state to decide whether to continue, try a different tool, or stop with a clear final answer.",
  "Use android.adbShell only when no typed tool can do the job. If reading Android settings, use the exact syntax: settings get <namespace> <key>, for example settings get global zen_mode.",
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
