import test from "node:test";
import assert from "node:assert/strict";
import {
  ResourceModes,
  createResourcePolicy,
  getResourcePolicy
} from "../src/core/resource-policy.js";

test("resource policy defaults to balanced adaptive behavior", () => {
  const policy = createResourcePolicy();
  assert.equal(policy.mode, ResourceModes.BALANCED);
  assert.equal(policy.backgroundMonitoring, "adaptive");
  assert.equal(policy.healthCheckInterval, "adaptive");
  assert.equal(policy.telemetryLevel, "minimal");
});

test("resource policy keeps security above resource savings", () => {
  const policy = getResourcePolicy();
  assert.ok(policy.principles.includes("preserve-security-and-routing-correctness-over-resource-savings"));
});

test("resource mode is explicitly user controlled", () => {
  assert.equal(createResourcePolicy({ mode: ResourceModes.EFFICIENT }).mode, ResourceModes.EFFICIENT);
  assert.throws(() => createResourcePolicy({ mode: "silent-auto" }), /unsupported resource mode/);
});
