import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const engine = process.env.CONTAINER_ENGINE || "docker";
const env = {
  ...process.env,
  ORCHESTRATOR_SHARED_SECRET: "compose-test-secret",
};
delete env.DISPLAY_WEBRTC_UDP_PORT;
delete env.TEST_DISPLAY_WEBRTC_UDP_PORT;

function loadCompose(file) {
  const path = fileURLToPath(new URL(`../deploy/${file}`, import.meta.url));
  const result = spawnSync(
    engine,
    [
      "compose",
      "--env-file",
      "/dev/null",
      "-f",
      path,
      "config",
      "--format",
      "json",
    ],
    { env, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  if (result.error) {
    throw new Error(
      `Could not invoke ${engine} Compose. Check CONTAINER_ENGINE.`,
      { cause: result.error },
    );
  }
  assert.equal(result.status, 0, `Could not resolve ${file}`);
  return JSON.parse(result.stdout);
}

function checkStack({ services }, port) {
  const { orchestrator, web, edge } = services;
  const display = services["display-sidecar"];
  const firewall = services["firewall-agent"];
  assert.equal(orchestrator.environment.WEB_INTERNAL_URL, "http://web:3101");
  assert.equal(display.environment.WEB_INTERNAL_URL, "http://web:3101");
  assert.equal(
    web.environment?.ORCHESTRATOR_API_URL ?? "http://orchestrator:4100",
    "http://orchestrator:4100",
  );
  for (const service of [orchestrator, web, edge, display]) {
    assert(
      Object.hasOwn(service.networks ?? {}, "platform"),
      `${service.container_name} needs the platform network`,
    );
  }
  assert(
    !web.ports?.length && !orchestrator.ports?.length,
    "Only the edge publishes web and API traffic",
  );

  const secretsPath = "/app/secrets/rebroid-shared-secret";
  const secretMounts = [orchestrator, web, display, firewall].map((service) =>
    service.volumes?.find((mount) => mount.target === "/app/secrets"),
  );
  const [firstMount] = secretMounts;
  assert(
    firstMount?.source &&
      secretMounts.every((mount) => mount?.source === firstMount.source),
  );
  assert.equal(
    display.environment.DISPLAY_SIDECAR_SHARED_SECRET_FILE,
    secretsPath,
  );
  assert.equal(
    orchestrator.environment.ORCHESTRATOR_SHARED_SECRET_FILE ?? secretsPath,
    secretsPath,
  );
  assert.equal(
    web.environment?.ORCHESTRATOR_SHARED_SECRET_FILE ?? secretsPath,
    secretsPath,
  );
  assert.equal(
    firewall.environment?.FIREWALL_AGENT_SHARED_SECRET_FILE ?? secretsPath,
    secretsPath,
  );

  for (const name of ["display-sidecar", "ocr-sidecar"]) {
    const service = services[name];
    assert(service.networks.platform.aliases.includes(service.container_name));
  }
  assert.equal(display.environment.DISPLAY_WEBRTC_UDP_PORT, port);
  assert.equal(orchestrator.environment.DISPLAY_WEBRTC_UDP_PORT, port);
  const udp = display.ports?.filter(({ protocol }) => protocol === "udp") ?? [];
  assert.equal(udp.length, 1);
  assert.equal(String(udp[0].target), port);
  assert.equal(String(udp[0].published), port);
  return firstMount.source;
}

const production = loadCompose("compose.yaml");
const test = loadCompose("compose.test.yaml");
const productionSecrets = checkStack(production, "40000");
const testSecrets = checkStack(test, "40101");
assert.notEqual(productionSecrets, testSecrets);
assert.equal(
  test.services.orchestrator.environment.ORCHESTRATOR_SHARED_SECRET,
  env.ORCHESTRATOR_SHARED_SECRET,
);
assert.equal(
  test.services.web.environment.ORCHESTRATOR_SHARED_SECRET,
  env.ORCHESTRATOR_SHARED_SECRET,
);
assert.equal(
  test.services["display-sidecar"].environment.DISPLAY_SIDECAR_SHARED_SECRET,
  env.ORCHESTRATOR_SHARED_SECRET,
);
assert.equal(
  test.services["firewall-agent"].environment.FIREWALL_AGENT_SHARED_SECRET,
  env.ORCHESTRATOR_SHARED_SECRET,
);
console.log("Compose wiring checks passed.");
