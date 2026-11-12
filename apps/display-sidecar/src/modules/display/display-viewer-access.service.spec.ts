import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import test from "node:test";
import { SidecarFeatureService } from "../shared/sidecar-feature.service";
import { DisplaySessionService } from "./display-session.service";
import { DisplayViewerAccessService } from "./display-viewer-access.service";

const setup = () => {
  const sessions = new DisplaySessionService(
    {
      sessionTtlSeconds: 900,
      sessionMaxLifetimeSeconds: 3600,
      sessionMaxActive: 10,
    } as never,
    new SidecarFeatureService(),
  );
  const grant = sessions.create({
    appId: randomUUID(),
    runtimeId: "a".repeat(64),
    ownerUserId: "alice",
    udid: "fixture:5555",
    capabilities: ["video", "clipboard"],
  });
  const access = new DisplayViewerAccessService(
    {
      webInternalUrl: "http://web:3101",
      sharedSecret: "internal-fixture",
    } as never,
    sessions,
  );
  return { access, grant, sessions };
};

const headersFor = (user: string): IncomingHttpHeaders => ({
  host: "rebroid.test",
  origin: "https://rebroid.test",
  "x-forwarded-proto": "https",
  cookie: `__Secure-next-auth.session-token=${user}; preference=hidden`,
});

test("a copied viewer URL is denied to an anonymous browser or another owner", async (t) => {
  const { access, grant, sessions } = setup();
  const authorize = t.mock.method(
    globalThis,
    "fetch",
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      assert.equal(
        String(input),
        "http://web:3101/api/internal/viewer/authorize",
      );
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("x-orchestrator-secret"), "internal-fixture");
      assert.equal(headers.get("x-rebroid-viewer-owner"), "alice");
      assert.equal(headers.get("x-rebroid-viewer-runtime"), "a".repeat(64));
      const cookie = headers.get("cookie");
      assert.ok(!cookie?.includes("preference"));
      return Response.json({
        ownerUserId: cookie?.endsWith("=alice") ? "alice" : "bob",
        capabilities: { control: false, clipboard: true, screenshot: false },
      });
    },
  );
  const url = new URL(grant.viewerPath, "https://rebroid.test");
  assert.deepEqual([...url.searchParams.keys()], ["sessionId"]);
  const id = url.searchParams.get("sessionId")!;
  await assert.rejects(
    access.admit(id, { ...headersFor("alice"), cookie: undefined }),
    /Unauthorized/,
  );
  await assert.rejects(
    access.admit(id, { ...headersFor("alice"), origin: "https://other.test" }),
    /Unauthorized/,
  );
  assert.equal(authorize.mock.callCount(), 0);
  await assert.rejects(
    access.admit(id, headersFor("bob")),
    /Display session not found/,
  );
  assert.equal(sessions.get(id).status, "created");
  const admission = await access.admit(id, headersFor("alice"));
  assert.equal(admission.session.status, "active");
  assert.equal(admission.session.id, id);
});

test("owner revocation closes admissions immediately and fences delayed authorization", async (t) => {
  const { access, grant, sessions } = setup();
  const allowed = () =>
    Response.json({
      ownerUserId: "alice",
      capabilities: { control: false, clipboard: true, screenshot: false },
    });
  const authorize = t.mock.method(globalThis, "fetch", async () => allowed());
  const admission = await access.admit(grant.id, headersFor("alice"));
  const closed = t.mock.fn();
  t.after(admission.watch(closed));
  let allowPending!: (response: Response) => void;
  authorize.mock.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        allowPending = resolve;
      }),
  );
  const pending = access.admit(grant.id, headersFor("alice"));
  sessions.releaseForOwners(["alice"]);
  assert.equal(closed.mock.callCount(), 1);
  allowPending(allowed());
  await assert.rejects(pending, /Display session not found/);
});

test("an active viewer closes when current permissions no longer allow its grant", async (t) => {
  const { access, grant } = setup();
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let clipboard = true;
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      ownerUserId: "alice",
      capabilities: { control: false, clipboard, screenshot: false },
    }),
  );
  const admission = await access.admit(grant.id, headersFor("alice"));
  let notifyRevoked!: () => void;
  const revoked = new Promise<void>((resolve) => {
    notifyRevoked = resolve;
  });
  t.after(admission.watch(notifyRevoked));
  clipboard = false;
  t.mock.timers.tick(10_000);
  await revoked;
});

test("revoking one browser closes only its connection to a shared display session", async (t) => {
  const { access, grant, sessions } = setup();
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let revoked = false;
  let otherRechecked = false;
  t.mock.method(
    globalThis,
    "fetch",
    async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const cookie = new Headers(init?.headers).get("cookie");
      if (revoked && cookie?.endsWith("=first-browser")) {
        return new Response(null, { status: 403 });
      }
      if (revoked && cookie?.endsWith("=second-browser")) {
        otherRechecked = true;
      }
      return Response.json({
        ownerUserId: "alice",
        capabilities: { control: false, clipboard: true, screenshot: false },
      });
    },
  );
  const first = await access.admit(grant.id, headersFor("first-browser"));
  const second = await access.admit(grant.id, headersFor("second-browser"));
  let notifyFirstClosed!: () => void;
  const firstClosed = new Promise<void>((resolve) => {
    notifyFirstClosed = resolve;
  });
  const secondClosed = t.mock.fn();
  t.after(first.watch(notifyFirstClosed));
  t.after(second.watch(secondClosed));

  revoked = true;
  t.mock.timers.tick(10_000);
  await firstClosed;
  assert.equal(otherRechecked, true);
  assert.equal(secondClosed.mock.callCount(), 0);
  assert.equal(sessions.get(grant.id).status, "active");
});

test("paired consumers admit independently, share rechecks, and detach independently", async (t) => {
  const { access, grant } = setup();
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let allowed = true;
  const authorize = t.mock.method(globalThis, "fetch", async () =>
    allowed
      ? Response.json({
          ownerUserId: "alice",
          capabilities: { control: false, clipboard: true, screenshot: false },
        })
      : new Response(null, { status: 403 }),
  );
  const media = await access.admit(grant.id, headersFor("same-browser"));
  const control = await access.admit(grant.id, headersFor("same-browser"));
  assert.equal(authorize.mock.callCount(), 2);

  const mediaClosed = t.mock.fn();
  const controlClosed = t.mock.fn();
  const detachMedia = media.watch(mediaClosed);
  t.after(detachMedia);
  t.after(control.watch(controlClosed));
  t.mock.timers.tick(10_000);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(authorize.mock.callCount(), 3);

  detachMedia();
  allowed = false;
  t.mock.timers.tick(10_000);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(authorize.mock.callCount(), 4);
  assert.equal(mediaClosed.mock.callCount(), 0);
  assert.equal(controlClosed.mock.callCount(), 1);
  t.mock.timers.tick(10_000);
  assert.equal(authorize.mock.callCount(), 4);
});
