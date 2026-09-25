import test from "node:test";
import assert from "node:assert/strict";
import { resolveRoutingPolicy } from "../src/core/policy-engine.js";

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
