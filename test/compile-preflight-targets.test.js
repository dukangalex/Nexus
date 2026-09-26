import test from "node:test";
import assert from "node:assert/strict";
import { preflightUnifiedConfig } from "../src/core/compile-preflight.js";
import { Kernels } from "../src/core/model.js";

const base = {
  kernel: Kernels.SING_BOX,
  nodes: [
    { id: "us-exit", name: "US Exit", protocol: "socks", server: "127.0.0.1", port: 1080 }
  ],
  routing: {
    defaultAction: { type: "route", target: "us-exit" },
    rules: []
  }
};

test("preflight accepts node id as a routing target", () => {
  const result = preflightUnifiedConfig(base, Kernels.SING_BOX);
  assert.equal(result.ok, true);
  assert.equal(result.errors.some((x) => x.code === "ROUTING_TARGET_UNRESOLVED"), false);
});

test("preflight accepts node name as a routing target", () => {
  const result = preflightUnifiedConfig({
    ...base,
    routing: { ...base.routing, defaultAction: { type: "route", target: "US Exit" } }
  }, Kernels.SING_BOX);
  assert.equal(result.ok, true);
});

test("preflight rejects an unresolved default routing target", () => {
  const result = preflightUnifiedConfig({
    ...base,
    routing: { ...base.routing, defaultAction: { type: "route", target: "missing-exit" } }
  }, Kernels.SING_BOX);
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((x) => x.code === "ROUTING_TARGET_UNRESOLVED" && x.target === "missing-exit"), true);
});

test("preflight rejects an unresolved rule target", () => {
  const result = preflightUnifiedConfig({
    ...base,
    routing: {
      ...base.routing,
      rules: [{ id: "r1", name: "r1", match: { domain: ["example.com"] }, action: { type: "route", target: "missing-exit" } }]
    }
  }, Kernels.SING_BOX);
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((x) => x.code === "ROUTING_TARGET_UNRESOLVED" && x.location === "routing.rules[0].action"), true);
});

test("preflight allows built-in reject target", () => {
  const result = preflightUnifiedConfig({
    ...base,
    routing: { ...base.routing, defaultAction: { type: "reject" } }
  }, Kernels.SING_BOX);
  assert.equal(result.ok, true);
});
