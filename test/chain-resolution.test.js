import test from "node:test";
import assert from "node:assert/strict";
import { createGroup } from "../src/core/group.js";
import { resolveChain } from "../src/core/chain-resolution.js";

test("resolves a multi-hop chain through groups", () => {
  const nodes = [{ id: "entry" }, { id: "relay-1", latencyMs: 50 }, { id: "relay-2", latencyMs: 20 }, { id: "exit" }];
  const groups = {
    relay: createGroup({ id: "relay", name: "Relay", type: "url_test", members: ["relay-1", "relay-2"] })
  };
  const result = resolveChain([{ id: "entry" }, { group: "relay" }, { id: "exit" }], { nodes, groups });
  assert.equal(result.ok, true);
  assert.deepEqual(result.data.hops.map((node) => node.id), ["entry", "relay-2", "exit"]);
});

test("fails closed when a group has no usable members", () => {
  const groups = { relay: createGroup({ id: "relay", name: "Relay", type: "fallback", members: ["dead"] }) };
  const result = resolveChain([{ id: "entry" }, { group: "relay" }, { id: "exit" }], {
    nodes: [{ id: "entry" }, { id: "dead", state: "failed" }, { id: "exit" }],
    groups
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /no usable member/);
});

test("rejects duplicate nodes and self chains", () => {
  const result = resolveChain([{ id: "entry" }, { id: "entry" }], {
    nodes: [{ id: "entry" }, { id: "exit" }]
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /duplicate\/self/);
});

test("rejects nested chain cycles", () => {
  const cyclic = { id: "loop", chain: [{ id: "entry" }, { id: "loop", chain: [{ id: "entry" }, { id: "exit" }] }] };
  const result = resolveChain([cyclic, { id: "exit" }], {
    nodes: [{ id: "entry" }, { id: "exit" }]
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /cycle/);
});

test("enforces maximum nested chain depth", () => {
  const nested = { id: "deep", chain: [{ id: "entry" }, { id: "exit" }] };
  const result = resolveChain([{ id: "entry" }, nested], {
    nodes: [{ id: "entry" }, { id: "exit" }],
    maxDepth: 0
  });
  assert.equal(result.ok, true);

  const limited = resolveChain([{ id: "entry" }, { id: "deep", chain: [{ id: "entry" }, nested] }], {
    nodes: [{ id: "entry" }, { id: "exit" }],
    maxDepth: 1
  });
  assert.equal(limited.ok, false);
  assert.match(limited.error, /depth exceeded|duplicate\/self/);
});
