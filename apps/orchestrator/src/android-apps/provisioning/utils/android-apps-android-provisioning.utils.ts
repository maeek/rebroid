interface AndroidBootReadiness {
  ready: boolean;
  probe: string;
}

export const androidBootProbeProperties = [
  'dev.bootcomplete',
  'service.bootanim.exit',
  'init.svc.bootanim',
  'init.svc.zygote',
  'init.svc.zygote64',
  'init.svc.surfaceflinger',
  'init.svc.servicemanager',
  'init.svc.hwservicemanager',
  'init.svc.adbd',
] as const;

export const parseAndroidBootReadiness = (
  output: string,
): AndroidBootReadiness => {
  const props = new Map<string, string>();
  for (const line of output.split(/\r?\n/)) {
    const separator = line.indexOf('=');
    if (separator <= 0) {
      continue;
    }
    props.set(
      line.slice(0, separator).trim(),
      line.slice(separator + 1).trim(),
    );
  }

  const get = (prop: string) => props.get(prop) ?? '';
  const running = (prop: string) => get(prop) === 'running';
  const bootPropertyComplete =
    get('dev.bootcomplete') === '1' || get('service.bootanim.exit') === '1';
  const bootAnimationDone =
    get('init.svc.bootanim') === 'stopped' ||
    get('service.bootanim.exit') === '1';
  const zygoteReady =
    running('init.svc.zygote') || running('init.svc.zygote64');
  const coreServicesReady =
    zygoteReady &&
    running('init.svc.surfaceflinger') &&
    running('init.svc.servicemanager') &&
    running('init.svc.hwservicemanager');
  const ready =
    bootPropertyComplete || (bootAnimationDone && coreServicesReady);
  const probe = androidBootProbeProperties
    .map((prop) => `${prop}=${get(prop) || '<empty>'}`)
    .join(' ');

  return { ready, probe };
};

export const androidBootDiagnosticSummary = (text: string) => {
  const reasons: string[] = [];
  if (
    text.includes('binder') &&
    text.match(/no such file|not found|cannot access/)
  ) {
    reasons.push('binder devices may be missing inside the runtime container');
  }
  if (text.includes('permission denied')) {
    reasons.push(
      'container permissions or security profile may be blocking Redroid',
    );
  }
  if (
    text.includes('avc:') ||
    text.includes('apparmor') ||
    text.includes('seccomp')
  ) {
    reasons.push('host security policy may be blocking Redroid');
  }
  if (text.includes('no space left')) {
    reasons.push('runtime data volume or Docker storage may be full');
  }
  if (text.includes('zygote') && !text.includes('init.svc.zygote=running')) {
    reasons.push('Android zygote service is not running');
  }
  if (
    text.includes('ashmem') &&
    text.match(/no such file|not found|cannot access|couldn't create ashmem/)
  ) {
    if (
      text.includes('ro.boot.use_memfd=true') ||
      text.includes('sys.use_memfd=true')
    ) {
      reasons.push(
        'Android display stack is still trying to use ashmem even though memfd is enabled; host /dev/ashmem support may still be required for this image',
      );
    } else {
      reasons.push(
        'Android display stack is trying to use ashmem; recreate the container with androidboot.use_memfd=true',
      );
    }
  }

  return (
    reasons.join('; ') ||
    'no obvious boot blocker detected from container diagnostics'
  );
};

export const truncateDiagnosticText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}\n... truncated ${value.length - maxLength} chars`;
};
