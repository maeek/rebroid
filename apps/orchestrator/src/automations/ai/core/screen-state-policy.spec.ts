import { strict as assert } from 'node:assert';
import {
  correctScreenStateHypothesis,
  isSettingsOpenClaimConfirmed,
  rankObservationCandidates,
  reconcileScreenStateHypothesis,
  summarizeObservationCandidates,
  summarizeVisualAffordances,
} from './screen-state-policy';

describe('automation AI screen-state policy', () => {
  it('corrects quick-settings screens mislabeled as Settings', () => {
    const corrected = correctScreenStateHypothesis({
      screenKind: 'settings_app',
      confidence: 0.9,
      visibleText: ['Internet', 'Bluetooth', 'Battery Saver'],
      controls: [{ label: 'Settings gear', role: 'icon' }],
      evidence: ['Brightness slider and quick settings tiles visible.'],
      uncertainty: [],
      summary: 'Settings app opened.',
    });

    assert.equal(corrected.screenKind, 'quick_settings');
    assert.equal(corrected.settingsAccessVisible, true);
    assert.ok(corrected.confidence < 0.9);
    assert.ok(corrected.correctionReason?.includes('internet'));
  });

  it('downgrades weak Settings-app VLM claims without confirming landmarks', () => {
    const reconciled = reconcileScreenStateHypothesis({
      state: {
        screenKind: 'settings_app',
        confidence: 0.95,
        visibleText: [],
        controls: [
          {
            label: 'Settings category list item',
            role: 'list_item',
            confidence: 0.9,
            evidence: ['The element is part of a scrollable settings list.'],
          },
        ],
        evidence: ['Represents actionable setting.'],
        uncertainty: [],
        summary: 'Android Settings app opened.',
      },
      candidates: [],
      confirmedFacts: [],
    });

    assert.equal(reconciled.screenKind, 'unknown');
    assert.equal(reconciled.rawScreenKind, 'settings_app');
    assert.equal(reconciled.visionReliable, false);
    assert.match(reconciled.contradictionReason ?? '', /without confirmed/);
  });

  it('reconciles quick-settings candidates over a Settings-app VLM claim', () => {
    const reconciled = reconcileScreenStateHypothesis({
      state: {
        screenKind: 'settings_app',
        confidence: 0.9,
        visibleText: ['Internet', 'Bluetooth', 'Battery Saver'],
        controls: [{ label: 'Settings access gear', role: 'icon' }],
        evidence: ['Brightness slider and quick setting tiles are visible.'],
        uncertainty: [],
        summary: 'Settings app opened.',
      },
      candidates: [
        {
          id: 'vision-1',
          label: 'Settings access gear',
          source: 'vision-model',
          role: 'icon',
          confidence: 0.82,
          evidence: ['Gear icon in quick settings footer'],
          bounds: { left: 0.86, top: 0.84, width: 0.08, height: 0.08 },
        },
      ],
      confirmedFacts: [],
    });

    assert.equal(reconciled.screenKind, 'quick_settings');
    assert.equal(reconciled.settingsAccessVisible, true);
    assert.equal(reconciled.visionReliable, false);
  });

  it('classifies app drawer landmarks separately from home', () => {
    const reconciled = reconcileScreenStateHypothesis({
      state: {
        screenKind: 'home',
        confidence: 0.7,
        visibleText: ['Search apps', 'All apps'],
        controls: [
          {
            label: 'Settings',
            role: 'app_icon',
            confidence: 0.8,
            evidence: ['App label in launcher grid'],
          },
        ],
        evidence: ['App drawer grid is visible.'],
        uncertainty: [],
        summary: 'Launcher app drawer is open.',
      },
      candidates: [],
      confirmedFacts: [],
    });

    assert.equal(reconciled.screenKind, 'app_drawer');
    assert.match(reconciled.correctionReason ?? '', /App-drawer/);
  });

  it('ranks and summarizes actionable visual candidates', () => {
    const candidates = rankObservationCandidates({
      goal: 'Open Android system Settings',
      candidates: [
        {
          id: 'tile',
          label: 'Bluetooth',
          source: 'vision-model',
          role: 'tile',
          confidence: 0.95,
        },
        {
          id: 'gear',
          label: 'Settings access gear',
          source: 'vision-model',
          role: 'icon',
          confidence: 0.82,
          evidence: ['Gear icon in lower right'],
          bounds: { left: 0.9, top: 0.86, width: 0.08, height: 0.08 },
        },
      ],
    });

    assert.equal(candidates[0]?.id, 'gear');
    assert.match(
      summarizeObservationCandidates({
        candidates,
        goal: 'Open Android system Settings',
      }),
      /#1 Settings access gear/,
    );
  });

  it('does not treat quick settings as confirmed Settings app completion', () => {
    assert.equal(
      isSettingsOpenClaimConfirmed({
        screenKind: 'quick_settings',
        confirmedFacts: [],
        visibleText: ['Internet', 'Bluetooth'],
      }),
      false,
    );
    assert.equal(
      isSettingsOpenClaimConfirmed({
        screenKind: 'settings_app',
        confirmedFacts: [
          'android.openSystemSettings opened the Android Settings main screen.',
        ],
        visibleText: [],
      }),
      true,
    );
  });

  it('summarizes visual affordances for planner recovery', () => {
    const summary = summarizeVisualAffordances({
      goal: 'Open Android system Settings',
      state: {
        screenKind: 'quick_settings',
        confidence: 0.72,
        settingsAccessVisible: true,
        visibleText: ['Internet', 'Bluetooth'],
        controls: [
          {
            label: 'Settings access gear',
            role: 'icon',
            confidence: 0.83,
            bounds: { left: 0.9, top: 0.86, width: 0.08, height: 0.08 },
            evidence: ['Gear icon visible in quick settings'],
          },
          { label: 'Bluetooth', role: 'tile', confidence: 0.9 },
        ],
        evidence: [],
        uncertainty: [],
        summary: 'Quick settings panel is open.',
      },
    });

    assert.match(summary, /Visual affordances are hypotheses/);
    assert.match(summary, /Settings access gear/);
    assert.match(summary, /x=0\.94, y=0\.9/);
  });
});
