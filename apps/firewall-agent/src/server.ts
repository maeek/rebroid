import { timingSafeEqual } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import {
  FirewallAdapter,
  FirewallPolicy,
  validatePolicies,
  validatePolicy,
} from "./firewall";
import { FirewallPolicyStore } from "./policy-store";

const maximumBodyBytes = 128 * 1024;

class RequestBodyTooLargeError extends Error {}
class InvalidRequestBodyError extends Error {}

const json = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
};

const authorized = (request: IncomingMessage, secret: string) => {
  if (!secret) return false;
  const provided = request.headers["x-firewall-agent-secret"];
  if (typeof provided !== "string") return false;
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
  secret: string;
  startupError?: string;
  adapter?: FirewallAdapter;
  store: FirewallPolicyStore;
}

export const createFirewallAgentServer = ({
  secret,
  startupError,
  adapter,
  store,
}: FirewallAgentServerOptions) => {
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
    if (!authorized(request, secret)) {
      json(response, 401, { message: "Unauthorized." });
      return;
    }
    if (startupError || !adapter) {
      json(response, 503, {
        message: startupError ?? "Firewall adapter is unavailable.",
      });
      return;
    }

    try {
      if (request.url === "/v1/reconcile" && request.method === "PUT") {
        const desired = validatePolicies(
          (await readJsonBody(request)) as {
            policies?: Partial<FirewallPolicy>[];
          },
        );
        const policies = store.replace(desired);
        adapter.reconcile(policies);
        json(response, 200, {
          status: "applied",
          message: "Firewall policies reconciled.",
        });
        return;
      }
      const match = request.url?.match(/^\/v1\/policies\/([^/?]+)$/);
      if (!match) {
        json(response, 404, { message: "Not found." });
        return;
      }
      const applicationId = decodeURIComponent(match[1]);
      if (request.method === "DELETE") {
        const policies = store.delete(applicationId);
        adapter.remove(applicationId, policies);
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
        const existing = store.get(applicationId);
        if (existing && existing.generation > policy.generation) {
          json(response, 409, { message: "Stale policy generation." });
          return;
        }
        const policies = store.set(policy);
        if (policy.enabled) adapter.apply(policy, policies);
        else adapter.remove(applicationId, policies);
        json(response, 200, {
          status: "applied",
          message: "Firewall policy applied.",
        });
        return;
      }
      json(response, 405, { message: "Method not allowed." });
    } catch (error) {
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
