import assert from "node:assert/strict";
import { isSessionExpired } from "../convex/authHelper.ts";
import { isAuthenticationError } from "../src/hooks/authSession.ts";

const now = Date.parse("2026-07-22T12:00:00.000Z");

assert.equal(isSessionExpired("2026-07-22T11:59:59.000Z", now), true);
assert.equal(isSessionExpired("2026-07-22T12:00:01.000Z", now), false);
assert.equal(isAuthenticationError(new Error("Server Error: No autenticado")), true);
assert.equal(isAuthenticationError(new Error("Usuario desactivado")), true);
assert.equal(isAuthenticationError(new Error("Fallo de red")), false);

console.log("Session auth recovery OK.");
