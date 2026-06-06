export { parseArguments } from "./harness/arguments";
export {
  AI_AUTOMATION_MASTER_SYSTEM_PROMPT,
  buildInitialMessages,
  buildScreenshotObservationMessage,
  buildUiXmlObservationMessage,
} from "./harness/messages";
export {
  buildChatRequestBody,
  chatCompletionsEndpoint,
  ollamaOptions,
} from "./harness/request-body";
export {
  consumeChatCompletionStream,
  type ChatCompletionStreamResult,
  type ChatCompletionStreamUpdate,
  type ChatToolCallDelta,
} from "./harness/streaming";
export {
  allowedToolMatcher,
  buildToolDefinitions,
  mapUsesByToolName,
  toolName,
} from "./harness/tools";
export {
  type AutomationCommandLike,
  type ChatContentPart,
  type ChatImageUrlContentPart,
  type ChatMessage,
  type ChatTextContentPart,
  type ChatToolCall,
} from "./harness/types";
