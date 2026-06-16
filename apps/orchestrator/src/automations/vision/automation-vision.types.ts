import type {
  VisionDetection,
  VisionObservation,
} from '@rebroid/vision-core/observation';
import type { AiObservationCandidate } from '@rebroid/ai-core/harness';
import type { OptimizedAiScreenshot } from '../ai/automation-ai-screenshot.utils';

export interface AutomationScreenObservation extends VisionObservation {
  aiImage?: OptimizedAiScreenshot;
  screenState?: AutomationVisionScreenState;
  candidates: AiObservationCandidate[];
  markedScreenshotId: string;
  reconciliation?: {
    rawScreenKind: AutomationVisionScreenState['screenKind'];
    rawConfidence: number;
    visionReliable: boolean;
    contradictionReason?: string;
  };
}

export interface AutomationVisionScreenControl {
  label: string;
  role?: string;
  evidence?: string[];
  bounds?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  confidence?: number;
}

export interface AutomationVisionScreenState {
  screenKind:
    | 'home'
    | 'app_drawer'
    | 'quick_settings'
    | 'notification_shade'
    | 'settings_app'
    | 'app_screen'
    | 'unknown';
  confidence: number;
  visibleText: string[];
  controls: AutomationVisionScreenControl[];
  evidence: string[];
  uncertainty: string[];
  summary: string;
  rawScreenKind?: AutomationVisionScreenState['screenKind'];
  rawSummary?: string;
  correctionReason?: string;
  settingsAccessVisible?: boolean;
}

export interface AutomationVisionContext {
  goal?: string;
  lastAction?: string;
  expectedOutcome?: string;
  confirmedFacts?: string[];
  latestHypothesis?: Pick<
    AutomationVisionScreenState,
    'screenKind' | 'confidence' | 'summary'
  >;
}

export interface AutomationVisionLocateInput {
  query: string;
  threshold: number;
  maxResults: number;
  region?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export interface AutomationVisionLocateOutput {
  matches: VisionDetection[];
  query: string;
  threshold: number;
  reason?: string;
}
