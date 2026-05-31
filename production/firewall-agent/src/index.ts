import { createServer } from "node:http";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { timingSafeEqual } from "node:crypto";
import {
  detectAdapter,
  FirewallPolicy,
  validatePolicies,
  validatePolicy,
} from "./firewall";

const socketPath =
  process.env.FIREWALL_AGENT_SOCKET ?? "/run/rebroid-firewall/agent.sock";
const statePath =
  process.env.FIREWALL_AGENT_STATE_PATH ??
  "/run/rebroid-firewall/policies.json";
const secret =
  process.env.FIREWALL_AGENT_SHARED_SECRET?.trim() ||
  readFileSync(
    process.env.FIREWALL_AGENT_SHARED_SECRET_FILE ??
      "/app/secrets/rebroid-shared-secret",
    "utf8",
  ).trim();
const policies = new Map<string, FirewallPolicy>();
let adapter: ReturnType<typeof detectAdapter> | undefined;
let startupError: string | undefined;

try {
  if (existsSync(statePath)) {
    const stored = JSON.parse(
      readFileSync(statePath, "utf8"),
    ) as FirewallPolicy[];
    for (const policy of stored) {
      policies.set(
        policy.applicationId,
        validatePolicy(policy.applicationId, policy),
      );
    }
  }
  adapter = detectAdapter(process.env.FIREWALL_ADAPTER);
  adapter.initialize();
  adapter.reconcile(policies);
} catch (error) {
  console.error(error);
  startupError = "No supported host firewall backend was detected.";
}

const persistPolicies = () => {
  writeFileSync(statePath, JSON.stringify([...policies.values()]), {
    mode: 0o600,
  });
};

const json = (
  response: import("node:http").ServerResponse,
  status: number,
  body: unknown,
) => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
};
const authorized = (request: import("node:http").IncomingMessage) => {
  const provided = request.headers["x-firewall-agent-secret"];
  if (typeof provided !== "string") return false;
  const expectedBuffer = Buffer.from(secret);
  const actualBuffer = Buffer.from(provided);
  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
};
const readJson = (request: import("node:http").IncomingMessage) =>
  new Promise<Partial<FirewallPolicy>>((resolve, reject) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
      if (body.length > 128 * 1024)
        reject(new Error("Request body is too large."));
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    request.on("error", reject);
  });

const server = createServer(async (request, response) => {
  if (request.url === "/v1/health" && request.method === "GET") {
    json(response, startupError ? 503 : 200, {
      ok: !startupError,
      status: startupError ? "unhealthy" : "healthy",
      adapter: adapter?.name ?? null,
      message: startupError ?? "Firewall agent is ready.",
    });
    return;
  }
  if (!authorized(request))
    return json(response, 401, { message: "Unauthorized." });
  if (startupError || !adapter)
    return json(response, 503, {
      message: startupError ?? "Firewall adapter is unavailable.",
    });

  try {
    if (request.url === "/v1/reconcile" && request.method === "PUT") {
      const desired = validatePolicies(
        (await readJson(request)) as { policies?: Partial<FirewallPolicy>[] },
      );
      policies.clear();
      for (const [applicationId, policy] of desired) {
        policies.set(applicationId, policy);
      }
      persistPolicies();
      adapter.reconcile(policies);
      return json(response, 200, {
        status: "applied",
        message: "Firewall policies reconciled.",
      });
    }
    const match = request.url?.match(/^\/v1\/policies\/([^/?]+)$/);
    if (!match) return json(response, 404, { message: "Not found." });
    const applicationId = decodeURIComponent(match[1]);
    if (request.method === "DELETE") {
      policies.delete(applicationId);
      persistPolicies();
      adapter.remove(applicationId, policies);
      return json(response, 200, {
        status: "applied",
        message: "Firewall policy removed.",
      });
    }
    if (request.method === "PUT") {
      const policy = validatePolicy(applicationId, await readJson(request));
      const existing = policies.get(applicationId);
      if (existing && existing.generation > policy.generation)
        return json(response, 409, { message: "Stale policy generation." });
      policies.set(applicationId, policy);
      persistPolicies();
      if (policy.enabled) adapter.apply(policy, policies);
      else adapter.remove(applicationId, policies);
      return json(response, 200, {
        status: "applied",
        message: "Firewall policy applied.",
      });
    }
    return json(response, 405, { message: "Method not allowed." });
  } catch (error) {
    console.error(error);
    return json(response, 400, { message: "Firewall operation failed." });
  }
});

mkdirSync(dirname(socketPath), { recursive: true });
rmSync(socketPath, { force: true });
server.listen(socketPath, () => chmodSync(socketPath, 0o660));
