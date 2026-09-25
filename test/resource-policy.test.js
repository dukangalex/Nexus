import test from "node:test";
import assert from "node:assert/strict";
import {
  ResourceModes,
  createResourcePolicy,
  applyResourceState,
  getResourcePolicy
} from "../src/core/resource-policy.js";
import { getDecisionRegistry, createDecisionPrompt } from "../src/core/decision-registry.js";

test("resource policy defaults to balanced adaptive behavior", () => {
  const policy = createResourcePolicy();
  assert.equal(policy.mode, ResourceModes.BALANCED);
  assert.equal(policy.backgroundMonitoring, "adaptive");
  assert.equal(policy.healthCheckInterval, "adaptive");
  assert.equal(policy.telemetryLevel, "minimal");
  assert.equal(policy.connectionIdleTimeout, 300);
});

test("resource policy keeps security above resource savings", () => {
  const policy = getResourcePolicy();
  assert.ok(policy.principles.includes("preserve-security-and-routing-correctness-over-resource-savings"));
});

test("resource modes are explicit and materially different", () => {
  const efficient = createResourcePolicy({ mode: ResourceModes.EFFICIENT });
  const performance = createResourcePolicy({ mode: ResourceModes.PERFORMANCE });

  assert.equal(efficient.backgroundMonitoring, "reduced");
  assert.equal(efficient.healthCheckInterval, "relaxed");
  assert.equal(efficient.connectionIdleTimeout, 600);
  assert.equal(performance.backgroundMonitoring, "active");
  assert.equal(performance.healthCheckInterval, "active");
  assert.equal(performance.telemetryLevel, "standard");
});

test("custom resource policy preserves explicit values", () => {
  const policy = createResourcePolicy({
    mode: ResourceModes.CUSTOM,
    backgroundMonitoring: "reduced",
    healthCheckInterval: "relaxed",
    telemetryLevel: "minimal",
    logLevel: "error",
    connectionIdleTimeout: 900,
    dnsCachePolicy: "bounded",
    ruleSetRefreshPolicy: "manual"
  });

  assert.deepEqual(
    {
      mode: policy.mode,
      backgroundMonitoring: policy.backgroundMonitoring,
      healthCheckInterval: policy.healthCheckInterval,
      telemetryLevel: policy.telemetryLevel,
      logLevel: policy.logLevel,
      connectionIdleTimeout: policy.connectionIdleTimeout,
      dnsCachePolicy: policy.dnsCachePolicy,
      ruleSetRefreshPolicy: policy.ruleSetRefreshPolicy
    },
    {
      mode: "custom",
      backgroundMonitoring: "reduced",
      healthCheckInterval: "relaxed",
      telemetryLevel: "minimal",
      logLevel: "error",
      connectionIdleTimeout: 900,
      dnsCachePolicy: "bounded",
      ruleSetRefreshPolicy: "manual"
    }
  );
});

test("idle and low-power state reduces background work without changing routing policy", () => {
  const policy = createResourcePolicy({ mode: ResourceModes.PERFORMANCE });
  const adapted = applyResourceState(policy, { lowPower: true });

  assert.equal(adapted.backgroundMonitoring, "reduced");
  assert.equal(adapted.healthCheckInterval, "relaxed");
  assert.equal(adapted.telemetryLevel, "minimal");
  assert.equal(adapted.logLevel, "warning");
  assert.equal(adapted.mode, ResourceModes.PERFORMANCE);
});

test("resource controls are explicit user decisions", () => {
  const registry = getDecisionRegistry();

  assert.ok(registry.userDecisions.includes("resourceMode"));
  assert.ok(registry.userDecisions.includes("healthCheckInterval"));

  const prompt = createDecisionPrompt("resourceMode", ["efficient", "balanced", "performance"]);
  assert.equal(prompt.requiresUserChoice, true);
  assert.deepEqual(prompt.options, ["efficient", "balanced", "performance"]);
});

test("invalid resource mode is rejected", () => {
  assert.throws(() => createResourcePolicy({ mode: "silent-auto" }), /unsupported resource mode/);
});
