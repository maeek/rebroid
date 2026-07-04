import { parseCommandLine } from "./command-line";

export { parseCommandLine };

export const redroidDefaultContainerArgs = [
  "androidboot.redroid_gpu_mode=guest",
  "androidboot.use_memfd=true",
  "ro.secure=0",
  "ro.debuggable=1",
  "androidboot.redroid_width=1080",
  "androidboot.redroid_height=2340",
  "androidboot.redroid_dpi=440",
  "androidboot.redroid_fps=60",
];

export type RedroidDisplayProfileId =
  | "phone-18-9"
  | "phone-19-5-9"
  | "phone-20-9"
  | "phone-21-9"
  | "phone-qhd-19-5-9"
  | "tablet-16-10"
  | "tablet-landscape-16-10";

export interface RedroidDisplayProfile {
  id: RedroidDisplayProfileId;
  kind: "phone" | "tablet";
  label: string;
  description: string;
  width: number;
  height: number;
  dpi: number;
  fps: number;
}

export interface RedroidDisplayConfig {
  width: number;
  height: number;
  dpi: number;
  fps?: number;
}

export const redroidDisplayProfiles: RedroidDisplayProfile[] = [
  {
    id: "phone-19-5-9",
    kind: "phone",
    label: "Modern phone",
    description: "1080 x 2340, 440 dpi",
    width: 1080,
    height: 2340,
    dpi: 440,
    fps: 60,
  },
  {
    id: "phone-18-9",
    kind: "phone",
    label: "Tall phone",
    description: "1080 x 2160, 420 dpi",
    width: 1080,
    height: 2160,
    dpi: 420,
    fps: 60,
  },
  {
    id: "phone-20-9",
    kind: "phone",
    label: "Phone 20:9",
    description: "1080 x 2400, 420 dpi",
    width: 1080,
    height: 2400,
    dpi: 420,
    fps: 60,
  },
  {
    id: "phone-21-9",
    kind: "phone",
    label: "Cinema phone",
    description: "1080 x 2520, 420 dpi",
    width: 1080,
    height: 2520,
    dpi: 420,
    fps: 60,
  },
  {
    id: "phone-qhd-19-5-9",
    kind: "phone",
    label: "QHD phone",
    description: "1440 x 3120, 560 dpi",
    width: 1440,
    height: 3120,
    dpi: 560,
    fps: 60,
  },
  {
    id: "tablet-16-10",
    kind: "tablet",
    label: "Tablet 16:10",
    description: "1600 x 2560, 320 dpi",
    width: 1600,
    height: 2560,
    dpi: 320,
    fps: 60,
  },
  {
    id: "tablet-landscape-16-10",
    kind: "tablet",
    label: "Tablet landscape",
    description: "2560 x 1600, 320 dpi",
    width: 2560,
    height: 1600,
    dpi: 320,
    fps: 60,
  },
];

export const defaultRedroidDisplayProfileId: RedroidDisplayProfileId =
  "phone-19-5-9";

export const redroidDefaultsLabel = redroidDefaultContainerArgs.join(" ");

export type RuntimeImageKind = "redroid" | "generic";

export type RuntimeImageGmsMode = "none" | "microg";

export type RuntimeImageSignatureSpoofing =
  | "not_applicable"
  | "external_required"
  | "present_unverified"
  | "verified";

export type RuntimeImageMetadataSource = "stored" | "labels" | "name";

export interface RuntimeImageMetadata {
  runtimeKind: RuntimeImageKind;
  androidVersion?: string | null;
  architecture?: string | null;
  gmsMode: RuntimeImageGmsMode;
  signatureSpoofing: RuntimeImageSignatureSpoofing;
}

export interface RuntimeImageResolution {
  metadata: RuntimeImageMetadata;
  source: RuntimeImageMetadataSource;
}

export const runtimeImageLabelKeys = {
  managed: "com.rebroid.managed",
  runtimeKind: "com.rebroid.runtime.kind",
  androidVersion: "com.rebroid.redroid.android_version",
  architecture: "com.rebroid.redroid.arch",
  gmsMode: "com.rebroid.gms.mode",
  signatureSpoofing: "com.rebroid.signature_spoofing",
} as const;

export const defaultGenericRuntimeImageMetadata: RuntimeImageMetadata = {
  runtimeKind: "generic",
  androidVersion: null,
  architecture: null,
  gmsMode: "none",
  signatureSpoofing: "not_applicable",
};

export const defaultRedroidRuntimeImageMetadata: RuntimeImageMetadata = {
  runtimeKind: "redroid",
  androidVersion: null,
  architecture: null,
  gmsMode: "none",
  signatureSpoofing: "external_required",
};

const runtimeImageKinds = ["redroid", "generic"] as const;
const runtimeImageGmsModes = ["none", "microg"] as const;
const runtimeImageSignatureSpoofingStates = [
  "not_applicable",
  "external_required",
  "present_unverified",
  "verified",
] as const;

const enumValue = <Value extends string>(
  value: string | null | undefined,
  allowed: readonly Value[],
) => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return allowed.find((item) => item === normalized) ?? null;
};

const nullableLabelValue = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const isRedroidImageName = (image: string) => {
  const normalized = image.trim().toLowerCase();
  return (
    normalized === "redroid" ||
    normalized.startsWith("redroid/") ||
    normalized.includes("/redroid")
  );
};

export const runtimeImageMetadataFromLabels = (
  labels: Record<string, string | undefined> | null | undefined,
): RuntimeImageMetadata | null => {
  if (!labels) {
    return null;
  }

  const runtimeKind = enumValue(
    labels[runtimeImageLabelKeys.runtimeKind],
    runtimeImageKinds,
  );
  if (!runtimeKind) {
    return null;
  }

  const gmsMode =
    enumValue(labels[runtimeImageLabelKeys.gmsMode], runtimeImageGmsModes) ??
    "none";
  const signatureSpoofing =
    enumValue(
      labels[runtimeImageLabelKeys.signatureSpoofing],
      runtimeImageSignatureSpoofingStates,
    ) ?? (runtimeKind === "redroid" ? "external_required" : "not_applicable");

  return {
    runtimeKind,
    androidVersion: nullableLabelValue(
      labels[runtimeImageLabelKeys.androidVersion],
    ),
    architecture: nullableLabelValue(
      labels[runtimeImageLabelKeys.architecture],
    ),
    gmsMode,
    signatureSpoofing,
  };
};

export const runtimeImageMetadataFromName = (
  image: string,
): RuntimeImageMetadata => {
  if (!isRedroidImageName(image)) {
    return { ...defaultGenericRuntimeImageMetadata };
  }

  const versionMatch = image.match(/(?:^|[:/])(\d{2})(?:\.|[-:]|$)/);
  return {
    ...defaultRedroidRuntimeImageMetadata,
    androidVersion: versionMatch?.[1] ?? null,
  };
};

export const resolveRuntimeImageMetadata = ({
  image,
  labels,
  metadata,
}: {
  image: string;
  labels?: Record<string, string | undefined> | null;
  metadata?: RuntimeImageMetadata | null;
}): RuntimeImageResolution => {
  if (metadata) {
    return { metadata, source: "stored" };
  }

  const labelMetadata = runtimeImageMetadataFromLabels(labels);
  if (labelMetadata) {
    return { metadata: labelMetadata, source: "labels" };
  }

  return { metadata: runtimeImageMetadataFromName(image), source: "name" };
};

export const resolveRuntimeImageKind = (
  input:
    | string
    | {
        image: string;
        labels?: Record<string, string | undefined> | null;
        metadata?: RuntimeImageMetadata | null;
      },
) => {
  if (typeof input === "string") {
    return runtimeImageMetadataFromName(input).runtimeKind;
  }

  return resolveRuntimeImageMetadata(input).metadata.runtimeKind;
};

export const isRedroidRuntimeKind = (
  runtimeKind: RuntimeImageKind | null | undefined,
) => runtimeKind === "redroid";

export const isRedroidRuntime = (
  image: string,
  runtimeKind?: RuntimeImageKind | null,
) => isRedroidRuntimeKind(runtimeKind) || isRedroidImageName(image);

export const redroidDisplayArgsForProfile = (id: string) => {
  const profile = getRedroidDisplayProfile(id);
  return redroidDisplayArgsForConfig(profile);
};

export const getRedroidDisplayProfile = (id: string) =>
  redroidDisplayProfiles.find((profile) => profile.id === id) ??
  redroidDisplayProfiles.find(
    (profile) => profile.id === defaultRedroidDisplayProfileId,
  ) ??
  redroidDisplayProfiles[0];

const redroidDisplayArgsForConfig = (config: RedroidDisplayConfig) => {
  return [
    `androidboot.redroid_width=${config.width}`,
    `androidboot.redroid_height=${config.height}`,
    `androidboot.redroid_dpi=${config.dpi}`,
    `androidboot.redroid_fps=${config.fps ?? 60}`,
  ].join(" ");
};

const findArgValue = (
  containerArgs: string | null | undefined,
  key: string,
) => {
  const match = splitContainerArgs(containerArgs ?? "").find((arg) =>
    arg.startsWith(`${key}=`),
  );
  return match?.slice(key.length + 1) ?? null;
};

const splitContainerArgs = (value: string) =>
  value.trim().split(/\s+/).filter(Boolean);

const positiveNumberArg = (
  containerArgs: string | null | undefined,
  key: string,
) => {
  const parsed = Number(findArgValue(containerArgs, key));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const applyRedroidDefaultContainerArgs = (
  image: string,
  containerArgs?: string | null,
  runtimeKind?: RuntimeImageKind | null,
) => {
  const trimmedArgs = containerArgs?.trim();
  if (!isRedroidRuntime(image, runtimeKind)) {
    return trimmedArgs ?? null;
  }

  const userArgs = parseCommandLine(trimmedArgs) ?? [];
  const userKeys = new Set(
    userArgs
      .map((arg) => arg.split("=")[0]?.trim())
      .filter((key): key is string => Boolean(key)),
  );
  const missingDefaults = redroidDefaultContainerArgs.filter(
    (arg) => !userKeys.has(arg.split("=")[0]),
  );

  return [...missingDefaults, ...userArgs].join(" ") || null;
};

export const applyRedroidDisplayContainerArgs = (
  image: string,
  displayProfileId: string,
  extraArgs = "",
  displayConfig?: RedroidDisplayConfig,
  runtimeKind?: RuntimeImageKind | null,
) => {
  if (!isRedroidRuntime(image, runtimeKind)) {
    return extraArgs.trim() || null;
  }

  const displayArgs = displayConfig
    ? redroidDisplayArgsForConfig(displayConfig)
    : redroidDisplayArgsForProfile(displayProfileId);

  return applyRedroidDefaultContainerArgs(
    image,
    `${displayArgs} ${extraArgs}`,
    runtimeKind,
  );
};

export const getRedroidDisplayDimensionsFromArgs = (
  containerArgs: string | null | undefined,
) => {
  const width =
    positiveNumberArg(containerArgs, "androidboot.redroid_width") ?? 1080;
  const height =
    positiveNumberArg(containerArgs, "androidboot.redroid_height") ?? 2340;

  return {
    width,
    height,
    aspectRatio: width / height,
  };
};
