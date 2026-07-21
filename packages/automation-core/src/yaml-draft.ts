import type { AutomationDefinition } from "./definition";

export interface AutomationYamlDraft {
  yaml: string;
  definition: AutomationDefinition;
}

export type AutomationYamlDraftStreamEvent =
  | {
      type: "draft.started";
      message: string;
      data: { maxAttempts: number };
    }
  | {
      type: "draft.model.started";
      message: string;
      data: { providerId: string; modelId: string };
    }
  | {
      type: "draft.phase";
      message: string;
      data: { attempt: number; phase: string };
    }
  | {
      type: "draft.message.delta";
      message: string;
      data: { attempt: number };
    }
  | {
      type: "draft.validation.failed";
      message: string;
      data: { attempt: number };
    }
  | {
      type: "draft.repair.started";
      message: string;
      data: { attempt: number; nextAttempt: number };
    }
  | {
      type: "draft.clarification.requested";
      message: string;
      data: { question: string };
    }
  | {
      type: "draft.completed";
      message: string;
      data: AutomationYamlDraft;
    }
  | {
      type: "draft.failed";
      message: string;
      data: { status: number };
    };
