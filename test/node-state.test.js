import test from "node:test";
import assert from "node:assert/strict";
import { NodeStates, canTransition, getNodeState, isNodeUsable, nodeStatePenalty, transitionNodeState } from "../src/core/node-state.js";

test("node state resolution prefers explicit snapshot state", () => {
  const node = { id: "n1", state: NodeStates.ACTIVE };
  assert.equal(getNodeState(node, { n1: { state: NodeStates.DEGRADED } }), NodeStates.DEGRADED);
  assert.equal(isNodeUsable(node, { n1: NodeStates.FAILED }), false);
  assert.equal(isNodeUsable(node, { n1: NodeStates.ACTIVE }), true);
});

test("node state transitions are explicit and fail closed", () => {
  assert.equal(canTransition(NodeStates.DISCOVERED, NodeStates.NORMALIZED), true);
  assert.equal(canTransition(NodeStates.ACTIVE, NodeStates.FAILED), true);
  assert.equal(canTransition(NodeStates.DISABLED, NodeStates.ACTIVE), false);
  assert.throws(() => transitionNodeState({ id: "n1", state: NodeStates.DISABLED }, NodeStates.ACTIVE), /invalid node state transition/);
  assert.equal(transitionNodeState({ id: "n1", state: NodeStates.ACTIVE }, NodeStates.DEGRADED).state, NodeStates.DEGRADED);
});

test("degraded state carries a deterministic selection penalty", () => {
  assert.equal(nodeStatePenalty({ id: "n1", state: NodeStates.DEGRADED }), 5000);
  assert.equal(nodeStatePenalty({ id: "n1", state: NodeStates.ACTIVE }), 0);
});
