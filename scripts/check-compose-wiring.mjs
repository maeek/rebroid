import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const engine = process.env.CONTAINER_ENGINE || "docker";
const defaultEnvironment = { ...process.env };
for (const name of [
  "REBROID_HTTPS_PORT",
  "REBROID_PORT",
  "DISPLAY_WEBRTC_UDP_PORT",
  "TEST_DISPLAY_WEBRTC_UDP_PORT",
  "EXTERNAL_ADB_BROKER_SECRET",
  "EXTERNAL_ADB_TCP_ENDPOINTS",
  "EXTERNAL_ADB_USB_SOURCE",
  "EXTERNAL_ADB_USB_PORTS",
  "EXTERNAL_ADB_USB_GID",
  "EXTERNAL_DISPLAY_WEBRTC_UDP_PORT",
  "TEST_EXTERNAL_DISPLAY_WEBRTC_UDP_PORT",
  "CONTAINER_ENGINE_SOCKET",
]) {
  delete defaultEnvironment[name];
}

function loadCompose(files, overrides = {}) {
  const args = files.flatMap((file) => [
    "-f",
    fileURLToPath(new URL(`../deploy/${file}`, import.meta.url)),
  ]);
  const result = spawnSync(
    engine,
    [
      ...(engine.endsWith("docker-compose") ? [] : ["compose"]),
      "--env-file",
      "/dev/null",
      ...args,
      "config",
      "--format",
      "json",
    ],
    {
      env: { ...defaultEnvironment, ...overrides },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
  if (result.error) {
    throw new Error(
      `Could not invoke ${engine} Compose. Check CONTAINER_ENGINE.`,
      { cause: result.error },
    );
  }
  assert.equal(result.status, 0, `Could not resolve ${files.join(" + ")}`);
  return JSON.parse(result.stdout);
}

function checkStack({ services }, httpsPort, mediaPort, engineSocket) {
  const { orchestrator, web, edge } = services;
  const display = services["display-sidecar"];
  const firewall = services["firewall-agent"];
  assert.equal(orchestrator.environment.WEB_INTERNAL_URL, "http://web:3101");
  assert.equal(
    orchestrator.environment.OCR_SIDECAR_BASE_URL,
    "http://ocr-sidecar:8100",
  );
  assert.equal(orchestrator.environment.DISPLAY_SIDECAR_AUTO_START, "false");
  assert.equal(
    web.environment?.ORCHESTRATOR_API_URL ?? "http://orchestrator:4100",
    "http://orchestrator:4100",
  );
  for (const service of [
    orchestrator,
    web,
    edge,
    display,
    services["ocr-sidecar"],
  ]) {
    assert(
      Object.hasOwn(service.networks ?? {}, "platform"),
      `${service.image} needs the platform network`,
    );
  }
  assert(
    !web.ports?.length && !orchestrator.ports?.length,
    "Only the edge publishes web and API traffic",
  );
  assert.equal(edge.ports.length, 1);
  assert.equal(String(edge.ports[0].published), httpsPort);
  assert.equal(edge.ports[0].target, 3443);
  assert.equal(edge.depends_on.web.condition, "service_healthy");
  assert.equal(edge.depends_on.web.restart, true);
  assert.equal(edge.depends_on["display-sidecar"].condition, "service_started");

  assert.equal(orchestrator.user, "0:0");
  assert(Object.values(services).every((service) => !service.privileged));
  assert.equal(firewall.network_mode, "host");
  assert.deepEqual(firewall.cap_add, ["NET_ADMIN"]);
  assert(!firewall.networks);
  const socketMounts = Object.entries(services).flatMap(([name, service]) =>
    (service.volumes ?? [])
      .filter(({ target }) => target === "/var/run/docker.sock")
      .map(({ source, type }) => ({ name, source, type })),
  );
  assert.deepEqual(socketMounts, [
    { name: "orchestrator", source: engineSocket, type: "bind" },
  ]);

  const secretServices = [orchestrator, web, display, firewall];
  const secretMounts = secretServices.map((service) =>
    service.volumes?.find((mount) => mount.target === "/app/secrets"),
  );
  const [firstMount] = secretMounts;
  assert(
    firstMount?.source &&
      secretMounts.every((mount) => mount?.source === firstMount.source),
  );
  assert(!firstMount.read_only);
  assert(secretMounts.slice(1).every((mount) => mount.read_only));
  assert(
    secretServices.every((service) =>
      Object.keys(service.environment ?? {}).every(
        (name) =>
          !/^(ORCHESTRATOR|DISPLAY_SIDECAR|FIREWALL_AGENT)_SHARED_SECRET/.test(
            name,
          ),
      ),
    ),
  );
  const webData = web.volumes.find((mount) => mount.target === "/app/data");
  const edgeData = edge.volumes.find((mount) => mount.target === "/app/data");
  assert.equal(edgeData.source, webData.source);
  assert(edgeData.read_only);

  assert.equal(
    display.container_name,
    orchestrator.environment.DISPLAY_SIDECAR_CONTAINER_NAME ??
      "rebroid-display-sidecar",
  );
  assert.equal(display.environment.DISPLAY_WEBRTC_UDP_PORT, mediaPort);
  assert.equal(orchestrator.environment.DISPLAY_WEBRTC_UDP_PORT, undefined);
  const udp = display.ports?.filter(({ protocol }) => protocol === "udp") ?? [];
  assert.equal(udp.length, 1);
  assert.equal(String(udp[0].target), mediaPort);
  assert.equal(String(udp[0].published), mediaPort);
  return firstMount.source;
}

const productionFiles = ["compose.yaml"];
const testFiles = ["compose.yaml", "compose.test.yaml"];
const production = loadCompose(productionFiles);
const test = loadCompose(testFiles);
const dockerSocket = "/var/run/docker.sock";
assert.equal(
  checkStack(production, "3443", "40000", dockerSocket),
  "shared-secrets",
);
assert.equal(
  checkStack(test, "3001", "40101", dockerSocket),
  "shared-test-secrets",
);
assert.equal(production.networks.platform.name, "rebroid-platform");
assert.equal(test.networks.platform.name, "rebroid-test-platform");
assert.equal(
  test.services.web.environment.DISPLAY_SIDECAR_INTERNAL_BASE_URL,
  `http://${test.services["display-sidecar"].container_name}:8000`,
);
for (const volume of Object.keys(test.volumes)) {
  assert(!Object.hasOwn(production.volumes, volume));
}
checkStack(
  loadCompose(productionFiles, {
    REBROID_HTTPS_PORT: "4443",
    DISPLAY_WEBRTC_UDP_PORT: "42000",
  }),
  "4443",
  "42000",
  dockerSocket,
);
checkStack(
  loadCompose(testFiles, {
    REBROID_PORT: "4444",
    TEST_DISPLAY_WEBRTC_UDP_PORT: "42001",
    DISPLAY_WEBRTC_UDP_PORT: "42000",
    CONTAINER_ENGINE_SOCKET: "/run/podman/podman.sock",
  }),
  "4444",
  "42001",
  "/run/podman/podman.sock",
);
function checkBroker({ services }, port, keyVolume) {
  const broker = services["external-adb"];
  assert.equal(broker.user, "1000:1000");
  assert.equal(broker.environment.EXTERNAL_ADB_ENABLED, "true");
  assert.equal(broker.image, services["display-sidecar"].image);
  assert.deepEqual(broker.build, services["display-sidecar"].build);
  assert.deepEqual(broker.cap_drop, ["ALL"]);
  assert(!broker.privileged);
  assert.equal(broker.init, true);
  assert.equal(broker.healthcheck, undefined);
  assert.equal(services["display-sidecar"].healthcheck, undefined);
  assert.equal(broker.ports.length, 1);
  assert.equal(broker.ports[0].protocol, "udp");
  assert.equal(broker.ports[0].target, port);
  assert.deepEqual(Object.keys(broker.networks), ["external-adb"]);
  assert.equal(
    services.edge.depends_on["external-adb"].condition,
    "service_started",
  );
  for (const service of [services.edge, services.orchestrator, services.web]) {
    assert(Object.hasOwn(service.networks, "external-adb"));
  }
  for (const service of [services.orchestrator, services.web]) {
    assert.equal(service.environment?.EXTERNAL_ADB_BROKER_SECRET, undefined);
    assert.equal(service.environment?.EXTERNAL_ADB_BROKER_SECRET_FILE, undefined);
  }
  assert.equal(services.orchestrator.environment.EXTERNAL_ADB_BROKER_URL, undefined);
  assert.equal(services.orchestrator.environment.EXTERNAL_ADB_TCP_ENDPOINTS, undefined);
  assert.equal(broker.environment.EXTERNAL_ADB_TCP_ENDPOINTS, undefined);
  assert.equal(broker.environment.DISPLAY_SIDECAR_SHARED_SECRET, undefined);
  assert.equal(broker.environment.DISPLAY_SIDECAR_SHARED_SECRET_FILE, undefined);
  assert.equal(
    broker.volumes.find(({ target }) => target === "/app/adb-keys")?.source,
    keyVolume,
  );
  const secrets = services.orchestrator.volumes.find(
    ({ target }) => target === "/app/secrets",
  );
  const brokerMount = broker.volumes.find(
    ({ source }) => source === secrets.source,
  );
  assert(brokerMount?.read_only);
  assert.equal(brokerMount.volume.subpath, "external-adb");
  assert.equal(brokerMount.volume.nocopy, true);
  assert.equal(broker.depends_on.orchestrator.condition, "service_healthy");
  assert.equal(brokerMount.target, "/run/rebroid-external-adb");
  assert(
    !services["display-sidecar"].volumes.some(
      ({ target }) => target === "/dev/bus/usb",
    ),
  );
}
checkBroker(production, 40002, "external-adb-keys");
checkBroker(test, 40102, "external-adb-test-keys");

const usbSettings = {
  EXTERNAL_ADB_USB_GID: "1002",
  EXTERNAL_ADB_USB_PORTS: "1-2",
};
for (const files of [productionFiles, testFiles]) {
  const { services } = loadCompose(files, {
    ...usbSettings,
    EXTERNAL_ADB_USB_SOURCE: "/dev/bus/usb",
  });
  const broker = services["external-adb"];
  assert.equal(broker.volumes.length, 2);
  assert(!broker.volumes.some(({ target }) => target === "/dev/bus/usb"));
  assert.equal(broker.environment.EXTERNAL_ADB_USB_PORTS, undefined);
  assert(!broker.group_add?.length);
  assert(!broker.device_cgroup_rules?.length);
  assert(!broker.devices?.length);
}

const customMediaPort = loadCompose(productionFiles, {
  EXTERNAL_ADB_BROKER_SECRET: "compose-test-external-device-secret",
  EXTERNAL_ADB_TCP_ENDPOINTS: "192.168.1.20:5555",
  EXTERNAL_DISPLAY_WEBRTC_UDP_PORT: "42002",
});
checkBroker(customMediaPort, 42002, "external-adb-keys");

const usb = loadCompose([...productionFiles, "compose.usb.yaml"], usbSettings);
checkBroker(usb, 40002, "external-adb-keys");
const usbMount = usb.services["external-adb"].volumes.find(
  ({ target }) => target === "/dev/bus/usb",
);
assert.equal(usbMount.type, "bind");
assert.equal(usbMount.source, "/dev/bus/usb");
assert(usbMount.read_only);
assert(!usbMount.bind?.create_host_path);
assert.deepEqual(usb.services["external-adb"].group_add, ["1002"]);
assert.deepEqual(usb.services["external-adb"].device_cgroup_rules, [
  "c 189:* rw",
]);
assert.equal(
  usb.services["external-adb"].environment.EXTERNAL_ADB_USB_PORTS,
  "1-2",
);

const edgeFile = (name) =>
  readFileSync(new URL(`../deploy/edge/${name}`, import.meta.url), "utf8");
const sidecarDockerfile = readFileSync(
  new URL("../apps/display-sidecar/Dockerfile", import.meta.url),
  "utf8",
);
assert.match(sidecarDockerfile, /^HEALTHCHECK .*\/health\/ready/m);
assert.match(
  edgeFile("Dockerfile"),
  /COPY external-display\.conf \/opt\/rebroid-edge\/external-display\.conf/,
);
assert.match(
  edgeFile("nginx.conf.template"),
  /include \/opt\/rebroid-edge\/external-display\.conf;/,
);
assert.match(
  edgeFile("external-display.conf"),
  /proxy_pass http:\/\/external-adb:8000;/,
);
console.log("Compose wiring checks passed.");
