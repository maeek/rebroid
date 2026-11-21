import { timingSafeEqual } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import {
  InvalidFirewallPolicyError,
  isFirewallApplicationId,
  validatePolicies,
  validatePolicy,
} from "@rebroid/firewall-policy-core/policy";
import {
  firewallRecoveryPendingMessage,
  FirewallPolicyRecoveryPendingError,
  type FirewallPolicyRecovery,
} from "./policy-commands";
import { parsePolicyRemovalQuery } from "./policy-removal-query";

const maximumBodyBytes = 128 * 1024;

class RequestBodyTooLargeError extends Error {}
class InvalidRequestBodyError extends Error {}

const json = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
};

const authorized = (request: IncomingMessage, getSecret: () => string) => {
  const provided = request.headers["x-firewall-agent-secret"];
  if (typeof provided !== "string") return false;
  const secret = getSecret();
  if (!secret) return false;
  const expectedBuffer = Buffer.from(secret);
  const actualBuffer = Buffer.from(provided);
  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
};

async function readJsonBody(
  request: IncomingMessage,
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    bytes += chunk.byteLength;
    if (bytes > maximumBodyBytes) {
      request.resume();
      throw new RequestBodyTooLargeError("Request body is too large.");
    }
    chunks.push(chunk);
  }
  if (!bytes) return {};
  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks, bytes).toString("utf8"));
  } catch {
    throw new InvalidRequestBodyError("Invalid JSON body.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new InvalidRequestBodyError("Invalid JSON body.");
  return body as Record<string, unknown>;
}

interface FirewallAgentServerOptions {
  getSecret: () => string;
  recovery: FirewallPolicyRecovery;
}

export const createFirewallAgentServer = ({
  getSecret,
  recovery,
}: FirewallAgentServerOptions) => {
  const { commands, adapterName } = recovery;
  const startupError = commands
    ? ""
    : recovery.error instanceof Error
      ? `Firewall backend is unavailable: ${recovery.error.message}`
      : "Firewall backend is unavailable.";
  const server = createServer(async (request, response) => {
    if (request.url === "/v1/health" && request.method === "GET") {
      const error = [
        getSecret()
          ? ""
          : "Firewall agent shared secret is not configured; policy operations are disabled.",
        startupError,
        commands?.recoveryPending ? firewallRecoveryPendingMessage : "",
      ]
        .filter(Boolean)
        .join(" ");
      json(response, error ? 503 : 200, {
        ok: !error,
        status: error ? "unhealthy" : "healthy",
        adapter: adapterName ?? null,
        message: error || "Firewall agent is ready.",
      });
      return;
    }
    if (!authorized(request, getSecret)) {
      json(response, 401, { message: "Unauthorized." });
      return;
    }
    if (!commands) {
      json(response, 503, { message: startupError });
      return;
    }

    try {
      if (request.url === "/v1/reconcile" && request.method === "PUT") {
        const input = await readJsonBody(request);
        const desired = validatePolicies(input);
        const { startedAt } = input;
        if (
          typeof startedAt !== "number" ||
          !Number.isSafeInteger(startedAt) ||
          startedAt < 0
        ) {
          throw new InvalidRequestBodyError(
            "Invalid reconciliation timestamp.",
          );
        }
        if (commands.reconcile(desired, startedAt) === "stale") {
          json(response, 409, { message: "Stale reconciliation timestamp." });
          return;
        }
        json(response, 200, {
          status: "applied",
          message: "Firewall policies reconciled.",
        });
        return;
      }
      const [path, query] = (request.url ?? "").split("?", 2);
      const match = path.match(/^\/v1\/policies\/([^/]+)(\/refresh)?$/);
      if (!match) {
        json(response, 404, { message: "Not found." });
        return;
      }
      const applicationId = decodeURIComponent(match[1]);
      const refresh = Boolean(match[2]);
      if (request.method === "DELETE" && !refresh) {
        if (!isFirewallApplicationId(applicationId)) {
          json(response, 400, { message: "Invalid application id." });
          return;
        }
        const removal = parsePolicyRemovalQuery(query);
        if (!removal) {
          json(response, 400, { message: "Invalid policy removal query." });
          return;
        }
        const { expectedContainerId, generation, revision } = removal;
        if (
          commands.remove(
            applicationId,
            expectedContainerId,
            generation,
            revision,
          ) === "unchanged"
        ) {
          json(response, 200, { status: "unchanged" });
          return;
        }
        json(response, 200, {
          status: "applied",
          message: "Firewall policy removed.",
        });
        return;
      }
      if (request.method === "PUT") {
        const policy = validatePolicy(
          applicationId,
          await readJsonBody(request),
        );
        const result = refresh
          ? commands.refresh(policy)
          : commands.apply(policy);
        if (result === "stale") {
          json(response, 409, {
            message: "Stale policy revision, generation, or runtime.",
          });
          return;
        }
        json(response, 200, {
          status: "applied",
          message: "Firewall policy applied.",
        });
        return;
      }
      json(response, 405, { message: "Method not allowed." });
    } catch (error) {
      if (error instanceof FirewallPolicyRecoveryPendingError) {
        console.error(error);
        json(response, 503, { message: error.message });
        return;
      }
      if (error instanceof RequestBodyTooLargeError) {
        json(response, 413, { message: error.message });
        return;
      }
      if (
        error instanceof InvalidRequestBodyError ||
        error instanceof InvalidFirewallPolicyError
      ) {
        json(response, 400, { message: error.message });
        return;
      }
      console.error(error);
      json(response, 500, { message: "Firewall operation failed." });
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  return server;
};
