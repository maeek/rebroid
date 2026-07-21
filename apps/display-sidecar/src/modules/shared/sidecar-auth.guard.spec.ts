import assert from "node:assert/strict";
import test from "node:test";
import { UnauthorizedException } from "@nestjs/common";
import { SidecarAuthGuard } from "./sidecar-auth.guard";

const context = (secret?: string) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        headers: secret ? { "x-rebroid-sidecar-secret": secret } : {},
      }),
    }),
  }) as never;

test("internal authentication fails closed without a configured secret", () => {
  const guard = new SidecarAuthGuard({
    hasSharedSecret: false,
    allowUnauthenticatedInternalApi: false,
  } as never);
  assert.throws(() => guard.canActivate(context()), UnauthorizedException);
});

test("internal authentication accepts only the configured secret", () => {
  const guard = new SidecarAuthGuard({
    hasSharedSecret: true,
    sharedSecret: "expected",
    allowUnauthenticatedInternalApi: false,
  } as never);
  assert.equal(guard.canActivate(context("expected")), true);
  assert.throws(
    () => guard.canActivate(context("wrong")),
    UnauthorizedException,
  );
});

test("unauthenticated development access requires an explicit override", () => {
  const guard = new SidecarAuthGuard({
    hasSharedSecret: false,
    allowUnauthenticatedInternalApi: true,
  } as never);
  assert.equal(guard.canActivate(context()), true);
});
