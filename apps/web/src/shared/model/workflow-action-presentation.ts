export const automationActionGroups = [
  'Touch & gestures',
  'Text & clipboard',
  'Device & apps',
  'Timing',
  'Flow control',
  'Checks',
  'Files',
  'Screen & vision',
  'Network',
  'Debugging',
  'AI'
] as const

type Group = (typeof automationActionGroups)[number]
type Presentation = readonly [group: Group, label: string, keywords?: string]

export const automationActionPresentation: Readonly<Partial<Record<string, Presentation>>> = {
  'android.swipeNormalized': ['Touch & gestures', 'Swipe', 'direction relative position scroll up down left right'],
  'android.tapNormalized': ['Touch & gestures', 'Tap relative position', 'percent screen coordinates'],
  'android.swipe': ['Touch & gestures', 'Swipe by pixels', 'drag absolute coordinates'],
  'android.tap': ['Touch & gestures', 'Tap by pixels', 'absolute coordinates'],
  'android.tapText': ['Text & clipboard', 'Tap text', 'click label accessibility'],
  'android.inputText': ['Text & clipboard', 'Type text', 'input keyboard'],
  'android.setClipboard': ['Text & clipboard', 'Set Android clipboard', 'copy'],
  'android.getClipboard': ['Text & clipboard', 'Read Android clipboard', 'paste'],
  'android.viewerCommand': ['Device & apps', 'Device control', 'viewer command go home back wake recents volume'],
  'android.expandQuickSettings': ['Device & apps', 'Show quick settings', 'panel tiles pull down settings'],
  'android.collapsePanels': ['Device & apps', 'Close Android panels', 'quick settings'],
  'android.rotateDisplay': ['Device & apps', 'Set screen orientation', 'rotation portrait landscape'],
  'android.key': ['Device & apps', 'Press Android key', 'keycode keyboard enter'],
  'android.listPackages': ['Device & apps', 'List installed apps', 'package IDs'],
  'android.launchPackage': ['Device & apps', 'Launch app', 'open application package'],
  'android.openSystemSettings': ['Device & apps', 'Open Android Settings'],
  'android.getSetting': ['Device & apps', 'Read Android setting', 'namespace'],
  'android.adbShell': ['Device & apps', 'Run ADB shell command', 'terminal'],
  'android.wait': ['Timing', 'Wait for a duration', 'delay pause sleep'],
  'android.waitForText': ['Timing', 'Wait for text', 'label ready visible'],
  'flow.stop': ['Flow control', 'End workflow successfully', 'stop return'],
  'flow.fail': ['Flow control', 'Fail workflow', 'error terminate'],
  'assert.textExists': ['Checks', 'Require text on screen', 'assert text exists visible'],
  'assert.textMissing': ['Checks', 'Require text off screen', 'assert text missing absent'],
  'assert.fileExists': ['Checks', 'Require Android file', 'assert file exists'],
  'android.pushFile': ['Files', 'Write file to Android', 'push upload'],
  'android.pullFile': ['Files', 'Read file from Android', 'pull download'],
  'android.deleteFile': ['Files', 'Delete Android file', 'remove'],
  'android.fileExists': ['Files', 'Check whether file exists', 'check path'],
  'android.listFiles': ['Files', 'List Android files', 'directory contents'],
  'android.screenshot': ['Screen & vision', 'Capture screenshot', 'screen image'],
  'vision.observe': ['Screen & vision', 'Observe screen', 'OCR detections'],
  'vision.locate': ['Screen & vision', 'Find on screen', 'locate OCR element text'],
  'container.network.allowCidr': ['Network', 'Allow IPv4 address or range', 'CIDR allowlist'],
  'container.network.removeAllowedCidr': ['Network', 'Remove allowed IPv4 address or range', 'CIDR allowlist'],
  'container.network.clearAllowedCidrs': ['Network', 'Clear custom allowlist', 'CIDR'],
  'container.network.setRestrictions': ['Network', 'Set network restrictions', 'firewall internet'],
  'container.network.resetPolicy': ['Network', 'Reset network policy', 'firewall CIDR'],
  'debug.log': ['Debugging', 'Write to run log', 'message trace'],
  'artifact.saveScreenshot': ['Debugging', 'Save screenshot in run', 'artifact screen image'],
  'ai.run': ['AI', 'Run a device agent task', 'AI prompt model']
}

export const workflowRunStepLabel = (uses: string) => {
  if (uses === 'flow.condition') return 'Condition'
  if (uses === 'flow.switch') return 'Switch'
  if (uses === 'flow.repeat') return 'Repeat'
  return automationActionPresentation[uses]?.[1] ?? 'Workflow step'
}
