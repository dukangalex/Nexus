import test from "node:test";
import assert from "node:assert/strict";
import { createHealingPolicy, planSelfHealing, chooseHealthy, shouldFailover } from "../src/core/self-healing.js";

test("self-healing plans group reselection only when healthy candidates are insufficient", () => {
  const result = planSelfHealing({
    nodes: [{ id: "dead", state: "failed" }, { id: "ok", state: "available", latencyMs: 20 }],
    groups: [{ id: "relay", members: ["dead", "ok"] }],
    states: { dead: "failed", ok: "available" }
  });
  assert.equal(result.actions.length, 0);
});

test("self-healing creates a bounded action when all candidates fail", () => {
  const result = planSelfHealing({
    nodes: [{ id: "a", state: "failed" }, { id: "b", state: "disabled" }],
    groups: [{ id: "relay", members: ["a", "b"] }],
    states: { a: "failed", b: "disabled" },
    now: 1000
  });
  assert.equal(result.actions.length, 1);
  assert.equal(result.actions[0].type, "reselect-group");
  assert.deepEqual(result.affectedGroups, ["relay"]);
});

test("self-healing cooldown suppresses repeated actions", () => {
  const result = planSelfHealing({
    nodes: [{ id: "a", state: "failed" }],
    groups: [{ id: "relay", members: ["a"] }],
    states: { a: "failed" },
    now: 1000,
    lastActions: new Map([["relay", { at: 900 }]])
  });
  assert.equal(result.actions.length, 0);
});

test("healthy selection excludes degraded and failed nodes", () => {
  const node = chooseHealthy([
    { id: "degraded", latencyMs: 1, state: "degraded" },
    { id: "healthy", latencyMs: 50, state: "available" },
    { id: "failed", latencyMs: 2, state: "failed" }
  ]);
  assert.equal(node.id, "healthy");
});

test("healing policy and legacy failover threshold remain deterministic", () => {
  assert.equal(createHealingPolicy({ maxActionsPerCycle: 2 }).maxActionsPerCycle, 2);
  assert.equal(shouldFailover(3), true);
  assert.equal(shouldFailover(2), false);
});
