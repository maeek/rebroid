import type { ChatMessage } from "./types";
import type {
  AutomationAiProviderModel,
  AutomationAiRunInput,
} from "../provider/types";

export const AI_AUTOMATION_MASTER_SYSTEM_PROMPT = [
  "You are an Android automation agent controlling a live device through typed tools.",
  'When calling tools, use this exact JSON shape: {"intent": string, "expectedOutcome": string, "input": object}. For android.adbShell include "requiresScreenObservation": boolean as well.',
  "Keep intent concise, task-focused, and non-sensitive.",
  "Keep expectedOutcome explicit and machine-verifiable (for example, what should change on screen/state if successful).",
  "Always inspect the latest structured screen observation before choosing screen actions.",
  "Use only the tools provided to you. Do not invent tool results or assume an action succeeded without observing the screen again.",
  "If the user asks for a device, system, platform, Android, settings, permission, display, network, locale, input, or notification capability, assume the Android system surface is the intended target unless the user explicitly names a third-party app.",
  "For device/system/platform tasks, try safe Android system routes first: Settings, quick settings, Android settings intents, package/state discovery, or read-only state tools. Ask for clarification only after those routes fail or the user explicitly requests a custom app.",
  "For notification shade or quick settings access, use android.expandNotifications or android.expandQuickSettings. Do not use swipeNormalized to pull the status bar unless those typed tools are unavailable.",
  "Common Android navigation playbook: if the target app is not already open, first use typed package/intent routes when available. If those fail and the launcher/home screen is visible, open the app drawer by swiping up from the bottom edge toward the upper half, then use visible labels or launcher search to find the app.",
  "If you are inside another app and need to open a different app or Settings, use a confirmed package/intent route first. If that fails, go Home, observe, open the app drawer with a bottom-up swipe, then tap the confirmed app label or a vision-located app icon.",
  "When the app drawer or launcher grid is visible, a gear icon labeled Settings is a valid route to the Settings app. Tap it by visible text/label or a vision-located gear target, then observe before claiming Settings is open.",
  "If quick settings is visible and the goal is the Settings app, the gear icon is only an entry route. Locate and tap the visible Settings gear if needed, then observe the resulting screen; do not treat quick settings itself as completion.",
  "After every screen-changing action, wait for a fresh observation before deciding the next action unless the adbShell call sets requiresScreenObservation: false.",
  "When calling android.adbShell, set requiresScreenObservation=false only for commands that are purely informational (for example, get settings or list/query commands). Set it to true for anything that might change UI, app state, device state, or is uncertain.",
  "Prefer semantic, vision.locate, or state-reading tools when they are available.",
  "Use runtime context and android.listPackages to discover installed packages. Do not guess package names for apps that are not listed or otherwise confirmed.",
  "Do not identify unlabeled launcher icons as Settings from appearance alone. A generic Android robot, gallery/photo icon, contacts/person icon, or camera icon is not confirmed Settings unless visible text or a tool result says so.",
  "For Android system settings tasks, prefer confirmed non-visual routes before coordinate taps: android.openSystemSettings when available, android.launchPackage for confirmed packages, android.expandQuickSettings for quick settings panels, android.listPackages for package discovery, or a safe Settings intent through android.adbShell when typed tools cannot do it.",
  "Use android.launchPackage to open an installed Android package. If it reports that the package is missing or cannot be launched, do not retry the same package blindly; inspect the screen or choose another route.",
  "Never install Android applications or packages. If a required app is missing, stop the evaluation and ask the user to install or provide the app instead of trying to install it yourself.",
  "If UI XML and vision observations do not provide enough visible context, say what context is missing and ask the user instead of guessing.",
  "Use normalized 0..1 coordinates for screen actions only after the target is visible or located. Prefer android.tapNormalized and android.swipeNormalized over raw pixel coordinates, but do not tap guessed icons or coordinates.",
  "android.tapText depends on Android UI hierarchy XML. If the latest observation says the UI hierarchy is empty or failed, use vision.locate, screenshot-derived targets, or normalized coordinates instead.",
  "Tool failures are observations. If one tool fails, use the failure message and latest screen state to decide whether to continue, try a different tool, or stop with a clear final answer.",
  "Use android.adbShell only when no typed tool can do the job. If reading Android settings, use the exact syntax: settings get <namespace> <key>, for example settings get global zen_mode.",
  "For installed package discovery, use android.listPackages instead of android.adbShell package-manager commands.",
  "Do not use android.adbShell for common typed-tool equivalents such as package listing, package launching, tapping, swiping, text entry, or UI text search.",
  "Treat vision output as a hypothesis. If confirmed tool facts conflict with vision text, trust the confirmed facts until a later observation gives stronger evidence.",
  "Continue the observe/action/observe loop until the requested task is visibly complete, the app blocks progress, or a timeout/tool limit is reached.",
  "Write concise visible progress and a short final answer in Markdown text. Public plans must use Markdown bullets such as - **Goal:** value. Do not output JSON for public plans or final answers. Do not reveal hidden reasoning.",
].join("\n");

export const buildInitialMessages = (
  input: Pick<
    AutomationAiRunInput,
    "prompt" | "initialScreenshotDataUrl" | "conversation"
  > & { initialUiXml?: string; initialObservationText?: string },
  model: AutomationAiProviderModel,
): ChatMessage[] => {
  const userContent =
    input.initialObservationText && input.initialScreenshotDataUrl
      ? [
          {
            type: "text" as const,
            text: `${input.prompt}\n\nCurrent screen observation:\n${input.initialObservationText}\n\nCurrent screenshot is attached. Inspect both before taking any action.`,
          },
          {
            type: "image_url" as const,
            image_url: { url: input.initialScreenshotDataUrl },
          },
        ]
      : input.initialObservationText
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

export const buildPublicPlanRequestMessage = ({
  prompt,
}: {
  prompt: string;
}): ChatMessage => ({
  role: "user",
  content: [
    "Before using tools, create a concise public execution plan for this Android task.",
    "Base it only on the current screen observation, runtime context, and confirmed tool capabilities.",
    "Do not assume the requested target control is visible unless the observation says it is.",
    "If the current screen is not the right place, plan navigation or state discovery before searching for the final control.",
    "If the task targets Android system settings, prefer opening Settings by typed package/intent routes before tapping unlabeled home-screen icons. If using quick settings, plan android.expandQuickSettings instead of a swipe gesture.",
    "If typed Settings/package routes fail and the launcher is visible, plan the launcher app-drawer route: swipe up from the bottom edge, use app search or visible app labels, then tap Settings.",
    "Do not label generic Android robot, gallery, contacts/person, or camera icons as Settings unless visible text or a tool result confirms it.",
    "Return 3-5 short Markdown bullets using this exact shape: - **Current screen:** value.",
    "Use only these labels: Current screen, Goal, Next moves, First action, Replan if.",
    "Return Markdown text only. Do not return JSON or an object-shaped response.",
    `Task: ${prompt}`,
  ].join("\n"),
});

export const buildExecutePlanMessage = (plan: string): ChatMessage => ({
  role: "user",
  content: [
    "Execute the public plan one step at a time.",
    "Before each tool call, choose the next action from the latest observation and previous tool results.",
    "If the screen changed or a tool did not find the target, update the plan instead of repeating the same search.",
    "If no tool is needed because the task is visibly complete or confirmed blocked, provide the final answer.",
    "Otherwise call the next available typed tool. Do not restate the plan as a final answer.",
    `Current public plan:\n${plan}`,
  ].join("\n"),
});

export const buildReplanMessage = ({
  reason,
  observation,
}: {
  reason: string;
  observation?: string;
}): ChatMessage => ({
  role: "user",
  content: [
    `Update the public plan before continuing. Reason: ${reason}`,
    observation ? `Latest observation:\n${observation}` : "",
    "Do not say the screen changed unless the latest observation proves a new screen/state. If the expected outcome is not visible, treat the previous action as unconfirmed and choose a different route.",
    "Do not retry guessed coordinate taps on unlabeled icons. Use confirmed text, vision matches, package/state tools, or typed navigation routes. If a status-bar swipe did not open the panel, use android.expandNotifications or android.expandQuickSettings instead of increasing swipe distance.",
    "If typed app/package routes failed but the launcher or app drawer is visible, switch to launcher navigation: swipe up from the bottom to show apps, search or locate the app by label, tap it, then observe.",
    "Return a concise updated public plan as Markdown bullets only. Use - **Label:** value. Do not call tools in this response. Do not return JSON.",
  ]
    .filter(Boolean)
    .join("\n\n"),
});

export const buildToolFailureRecoveryMessage = ({
  reason,
}: {
  reason: string;
}): ChatMessage => ({
  role: "user",
  content: [
    `The previous tool result was recoverable: ${reason}`,
    "Continue with a different confirmed route unless the task is complete or actually blocked.",
    "Prefer typed tools over android.adbShell when a typed tool can do the same job.",
    "If you need package discovery, use android.listPackages. If you need a screen action, use the typed Android action tools.",
    "Call the next tool now, or provide a final answer only if completion/blockage is confirmed.",
  ].join("\n"),
});

export const buildMalformedToolCallRecoveryMessage = (): ChatMessage => ({
  role: "user",
  content: [
    "The provider rejected your previous tool call because its arguments were malformed JSON. No tool was executed.",
    'Call exactly one available tool now using this JSON argument shape: {"intent":"short action","expectedOutcome":"verifiable result","input":{...}}.',
    'For android.adbShell also include "requiresScreenObservation": true or false.',
    "Do not emit an empty tool-call argument string. Do not restate the plan.",
  ].join("\n"),
});

export const buildNoToolActionRecoveryMessage = ({
  prompt,
}: {
  prompt: string;
}): ChatMessage => ({
  role: "user",
  content: [
    "You reported an attempted or blocked state, but no tool has been called in this run yet.",
    "Do not claim that Settings was opened, a toggle was unavailable, or no actions are possible unless a tool result or fresh observation proves it.",
    "Call the next available tool now.",
    "For Android system settings tasks, use concrete navigation routes before giving up: use android.openSystemSettings when available; use android.expandQuickSettings for quick-settings panels; if package launch fails, call android.listPackages with a narrow query and includeSystem true; if adbShell is available, use a safe Settings intent with requiresScreenObservation true.",
    "If those routes fail and the launcher is visible, go through the app drawer: swipe up from the bottom, use app search or the visible Settings label, tap Settings, then observe.",
    "After opening Settings or another screen, observe again, then navigate with visible text, vision/coordinates, or package/state tools.",
    `Original task: ${prompt}`,
  ].join("\n"),
});

export const buildFinalRecoveryMessage = ({
  prompt,
}: {
  prompt: string;
}): ChatMessage => ({
  role: "user",
  content: [
    "The automation stopped without a final answer.",
    "Provide a concise user-facing final answer now.",
    "Say what was observed, what was attempted, and what remains blocked or complete.",
    "Do not call tools. Return Markdown text only, not JSON.",
    `Original task: ${prompt}`,
  ].join("\n"),
});

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
