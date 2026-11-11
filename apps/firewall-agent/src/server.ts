import { timingSafeEqual } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { FirewallPolicy, validatePolicies, validatePolicy } from "./firewall";
import {
  firewallRecoveryPendingMessage,
  FirewallPolicyRecoveryPendingError,
  type FirewallPolicyRecovery,
} from "./policy-commands";

const maximumBodyBytes = 128 * 1024;
const isNonnegativeInteger = (value: string) =>
  /^\d+$/.test(value) && Number.isSafeInteger(Number(value));

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

export const readJsonBody = (request: IncomingMessage) =>
  new Promise<Partial<FirewallPolicy>>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      request.removeListener("data", onData);
      request.resume();
      reject(error);
    };
    const onData = (chunk: Buffer) => {
      bytes += chunk.byteLength;
      if (bytes > maximumBodyBytes) {
        fail(new RequestBodyTooLargeError("Request body is too large."));
        return;
      }
      chunks.push(Buffer.from(chunk));
    };
    request.on("data", onData);
    request.on("end", () => {
      if (settled) return;
      settled = true;
      try {
        const body = Buffer.concat(chunks).toString("utf8");
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new InvalidRequestBodyError("Invalid JSON body."));
      }
    });
    request.on("error", fail);
  });

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
        const input = (await readJsonBody(request)) as {
          policies?: Partial<FirewallPolicy>[];
          startedAt?: number;
        };
        const desired = validatePolicies(input);
        if (
          input.startedAt !== undefined &&
          (!Number.isSafeInteger(input.startedAt) || input.startedAt < 0)
        ) {
          throw new Error("Invalid reconciliation timestamp.");
        }
        if (commands.reconcile(desired, input.startedAt) === "stale") {
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
        if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,63}$/.test(applicationId)) {
          json(response, 400, { message: "Invalid application id." });
          return;
        }
        let expectedContainerId: string | undefined;
        let generation: number | undefined;
        let revision: number | undefined;
        if (query !== undefined) {
          const params = new URLSearchParams(query);
          const containerIds = params.getAll("containerId");
          const generations = params.getAll("generation");
          const revisions = params.getAll("revision");
          if (
            params.size === 0 ||
            containerIds.length > 1 ||
            containerIds.includes("") ||
            generations.length > 1 ||
            revisions.length > 1 ||
            params.size !==
              containerIds.length + generations.length + revisions.length ||
            (generations.length > 0 &&
              (!containerIds.length ||
                !isNonnegativeInteger(generations[0]))) ||
            (revisions.length > 0 && !isNonnegativeInteger(revisions[0]))
          ) {
            json(response, 400, { message: "Invalid policy removal query." });
            return;
          }
          expectedContainerId = containerIds[0];
          if (generations.length) generation = Number(generations[0]);
          if (revisions.length) revision = Number(revisions[0]);
        }
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
        (error instanceof Error &&
          (/^Invalid /.test(error.message) ||
            error.message === "Only IPv4 CIDRs are supported."))
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
