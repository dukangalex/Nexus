import test from "node:test";
import assert from "node:assert/strict";
import { resolveRoutingPolicy, resolveRoutingDecision } from "../src/core/policy-engine.js";
import { resolveGroupMember } from "../src/core/group.js";

test("policy engine selects the first matching rule by order", () => {
  const result = resolveRoutingPolicy({
    rules: [
      { id: "intl", name: "International", order: 20, match: { geoip: ["!CN"] }, action: { type: "route", target: "Proxy" } },
      { id: "us", name: "US", order: 10, match: { domain_suffix: ["example.com"] }, action: { type: "route", target: "US" } }
    ],
    defaultAction: { type: "reject" }
  }, { domain: "www.example.com", geoip: "US" });
  assert.equal(result.ok, true);
  assert.equal(result.action.target, "US");
  assert.equal(result.rule.id, "us");
});

test("policy engine supports domain keyword matching", () => {
  const result = resolveRoutingPolicy({
    rules: [{ id: "ai", name: "AI", order: 1, match: { domain_keyword: ["openai"] }, action: { type: "route", target: "AI" } }],
    defaultAction: { type: "reject" }
  }, { domain: "api.openai.com" });
  assert.equal(result.action.target, "AI");
});

test("fail-closed rejects when no rule matches", () => {
  const result = resolveRoutingPolicy({
    rules: [{ id: "cn", name: "CN", order: 1, match: { geoip: ["CN"] }, action: { type: "bypass", target: "direct" } }],
    defaultAction: { type: "route", target: "Proxy" }
  }, { geoip: "US" }, { failClosed: true });
  assert.equal(result.action.type, "reject");
});

test("global proxy requires a concrete target", () => {
  const result = resolveRoutingPolicy({ mode: "global_proxy", rules: [], defaultAction: { type: "route", target: "Proxy" } });
  assert.equal(result.action.type, "route");
  assert.equal(result.action.target, "Proxy");
});

test("policy target resolves through the group engine", () => {
  const result = resolveRoutingDecision({
    rules: [{ id: "us", name: "US", order: 1, match: { domain_suffix: ["example.com"] }, action: { type: "route", target: "US" } }],
    defaultAction: { type: "reject" }
  }, { domain: "www.example.com" }, {
    groups: {
      US: { id: "US", name: "US", type: "url_test", members: ["us-1", "us-2"] }
    },
    nodes: [
      { id: "us-1", latencyMs: 80 },
      { id: "us-2", latencyMs: 30 }
    ],
    resolveGroupMember
  });
  assert.equal(result.ok, true);
  assert.equal(result.action.target, "us-2");
  assert.equal(result.action.group, "US");
});

test("policy rejects when a referenced group has no usable member", () => {
  const result = resolveRoutingDecision({
    rules: [{ id: "us", name: "US", order: 1, match: { domain_suffix: ["example.com"] }, action: { type: "route", target: "US" } }],
    defaultAction: { type: "reject" }
  }, { domain: "www.example.com" }, {
    groups: { US: { id: "US", name: "US", type: "select", members: ["us-1"] } },
    nodes: [{ id: "us-1", state: "failed" }],
    resolveGroupMember
  });
  assert.equal(result.ok, false);
  assert.equal(result.action.type, "reject");
});
