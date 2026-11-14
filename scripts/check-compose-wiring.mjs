import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const engine = process.env.CONTAINER_ENGINE || "docker";
const defaultEnvironment = { ...process.env };
for (const name of [
  "REBROID_HTTPS_PORT",
  "REBROID_PORT",
  "DISPLAY_WEBRTC_UDP_PORT",
  "TEST_DISPLAY_WEBRTC_UDP_PORT",
  "GAPPS_PATCHER_IMAGE",
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

function checkStack({ services }, httpsPort, mediaPort) {
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
      `${service.container_name} needs the platform network`,
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
        (name) => !name.includes("SHARED_SECRET"),
      ),
    ),
  );
  const webData = web.volumes.find((mount) => mount.target === "/app/data");
  const edgeData = edge.volumes.find((mount) => mount.target === "/app/data");
  assert.equal(edgeData.source, webData.source);
  assert(edgeData.read_only);

  assert(display.networks.platform.aliases.includes(display.container_name));
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
assert.equal(checkStack(production, "3443", "40000"), "shared-secrets");
assert.equal(checkStack(test, "3001", "40101"), "shared-test-secrets");
assert.equal(production.networks.platform.name, "rebroid-platform");
assert.equal(test.networks.platform.name, "rebroid-test-platform");
assert.equal(
  test.services.orchestrator.environment.DISPLAY_SIDECAR_CONTAINER_NAME,
  test.services["display-sidecar"].container_name,
);
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
);
checkStack(
  loadCompose(testFiles, {
    REBROID_PORT: "4444",
    TEST_DISPLAY_WEBRTC_UDP_PORT: "42001",
    DISPLAY_WEBRTC_UDP_PORT: "42000",
  }),
  "4444",
  "42001",
);
console.log("Compose wiring checks passed.");
