import test from "node:test";
import assert from "node:assert/strict";
import { NodeStates } from "../src/core/node-state.js";
import { recordProbe } from "../src/core/probe.js";

test("probe promotes a failed node only after the configured success threshold", () => {
  const node = { id: "n1", state: NodeStates.FAILED };
  const first = recordProbe(node, { ok: true, consecutiveSuccesses: 0 }, { successThreshold: 2 });
  assert.equal(first.state, NodeStates.FAILED);
  const second = recordProbe(first.node, { ok: true, consecutiveSuccesses: 1 }, { successThreshold: 2 });
  assert.equal(second.state, NodeStates.AVAILABLE);
  assert.equal(second.consecutiveFailures, 0);
});

test("probe marks an active node degraded before failing it", () => {
  const node = { id: "n1", state: NodeStates.ACTIVE };
  const first = recordProbe(node, { ok: false, consecutiveFailures: 0 }, { failureThreshold: 2 });
  assert.equal(first.state, NodeStates.DEGRADED);
  const second = recordProbe(first.node, { ok: false, consecutiveFailures: 1 }, { failureThreshold: 2 });
  assert.equal(second.state, NodeStates.FAILED);
});

test("disabled nodes are never revived by probe results", () => {
  const node = { id: "n1", state: NodeStates.DISABLED };
  const result = recordProbe(node, { ok: true, consecutiveSuccesses: 9 });
  assert.equal(result.state, NodeStates.DISABLED);
});
