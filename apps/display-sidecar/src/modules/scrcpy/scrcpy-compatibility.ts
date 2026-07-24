import type { ScrcpyAttemptResult, ScrcpyStreamOptions } from "./scrcpy.types";

const audioConfigurationFailureReason =
  "invalid audio stream: scrcpy stream configuration failed on the device";

export const compatibilityProbeServices = [
  "input",
  "settings",
  "display",
  "SurfaceFlinger",
] as const;

export const displayDiagnosticPattern =
  /scrcpy|MediaCodec|ACodec|CCodec|OMX|SoftAVC|VirtualDisplay|BufferQueue|Surface|surfaceflinger|gralloc|ashmem|RenderEngine|hwservicemanager|adbd|InputManagerGlobal|KeyCharacterMap|IDisplayWindowListener|Can't find service/i;

export interface ScrcpyCompatibilityProbe {
  androidRelease: string;
  androidSdk: number | null;
  productBrand: string;
  productModel: string;
  buildId: string;
  redroidVersion: string;
  services: Record<
    (typeof compatibilityProbeServices)[number],
    "found" | "missing" | "unknown"
  >;
  encoders: string[];
  diagnostics: string[];
}

const isCompatibilityService = (
  value: string,
): value is (typeof compatibilityProbeServices)[number] =>
  compatibilityProbeServices.some((service) => service === value);

export const parseCompatibilityProbe = (
  output: string,
  logcat: string,
): ScrcpyCompatibilityProbe => {
  const props = new Map<string, string>();
  const services = Object.fromEntries(
    compatibilityProbeServices.map((service) => [service, "unknown"]),
  ) as ScrcpyCompatibilityProbe["services"];
  const encoders: string[] = [];
  let section = "";

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (
      line === "== props ==" ||
      line === "== services ==" ||
      line === "== encoders =="
    ) {
      section = line;
      continue;
    }
    const separator = line.indexOf("=");
    if (section === "== props ==" && separator > 0) {
      props.set(line.slice(0, separator), line.slice(separator + 1));
      continue;
    }
    if (section === "== services ==" && separator > 0) {
      const name = line.slice(0, separator);
      if (isCompatibilityService(name)) {
        services[name] =
          line.slice(separator + 1) === "found" ? "found" : "missing";
      }
      continue;
    }
    if (section === "== encoders ==" && encoders.length < 80) {
      encoders.push(line);
    }
  }

  const sdk = Number(props.get("ro.build.version.sdk"));
  return {
    androidRelease: props.get("ro.build.version.release") ?? "",
    androidSdk: Number.isFinite(sdk) ? sdk : null,
    productBrand: props.get("ro.product.brand") ?? "",
    productModel: props.get("ro.product.model") ?? "",
    buildId: props.get("ro.build.id") ?? "",
    redroidVersion: props.get("ro.redroid.version") ?? "",
    services,
    encoders,
    diagnostics: logcat
      .split(/\r?\n/)
      .filter((line) => displayDiagnosticPattern.test(line))
      .slice(-40),
  };
};

export const shouldRetryWithoutStreamControl = (
  errorMessage: string,
  probe: ScrcpyCompatibilityProbe | null,
) => {
  const diagnostics = probe?.diagnostics.join("\n") ?? "";
  const text = `${errorMessage}\n${diagnostics}`;
  const androidSdk = probe?.androidSdk ?? 0;
  const mayBeAndroid15OrNewer = !probe || androidSdk >= 35;
  const redroidLike =
    /redroid/i.test(
      `${probe?.productBrand ?? ""} ${probe?.productModel ?? ""} ${probe?.redroidVersion ?? ""}`,
    ) || !probe;

  return (
    redroidLike &&
    mayBeAndroid15OrNewer &&
    /InputManagerGlobal|getInputDevice|KeyCharacterMap|Can't find service: settings|Can't find service: input|control|Timed out connecting to scrcpy socket/i.test(
      text,
    )
  );
};

export const selectInitialRetryStreamOptions = (
  options: ScrcpyStreamOptions,
  errorMessage: string,
  probe: ScrcpyCompatibilityProbe | null,
) => {
  if (options.audio) {
    return {
      ...options,
      audio: false,
      compatibilityMode: "audio-disabled" as const,
    };
  }
  if (
    options.control !== false &&
    shouldRetryWithoutStreamControl(errorMessage, probe)
  ) {
    return {
      ...options,
      control: false,
      compatibilityMode: "stream-control-disabled" as const,
    };
  }
  return options;
};

export const selectRestartStreamOptions = (
  options: ScrcpyStreamOptions,
  result: ScrcpyAttemptResult,
  audioDisabled: boolean,
) => {
  if (
    options.audio &&
    (result.reason === audioConfigurationFailureReason || audioDisabled)
  ) {
    return {
      ...options,
      audio: false,
      compatibilityMode: "audio-disabled" as const,
    };
  }
  return options;
};

export const compatibilityStateChanged = (
  previous: ScrcpyStreamOptions,
  next: ScrcpyStreamOptions,
) =>
  previous.compatibilityMode !== next.compatibilityMode ||
  previous.audio !== next.audio ||
  previous.control !== next.control;
