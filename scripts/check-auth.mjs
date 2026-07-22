import assert from "node:assert/strict";
import { emailError, passwordError } from "../src/components/auth/validation.js";

assert.equal(emailError("persona@cristovive.pe"), "");
assert.match(emailError("persona@"), /válido/);
assert.equal(passwordError("fe-esperanza"), "");
assert.match(passwordError("corta"), /8 caracteres/);
console.log("Auth validation OK.");
