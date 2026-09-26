import test from "node:test";
import assert from "node:assert/strict";
import {
  createRoutingRule,
  createRoutingPolicy,
  validateRoutingPolicy
} from "../src/core/routing-policy.js";

test("routing policy expresses explicit user-visible rules", () => {
  const rule = createRoutingRule({
    id: "google",
    name: "Google",
    match: { domain_suffix: ["google.com"] },
    action: { type: "route", target: "US" },
    order: 10
  });

  const policy = createRoutingPolicy({
    rules: [rule],
    strategies: [{ id: "US", type: "selector", members: ["us-1", "us-2"] }]
  });

  assert.equal(policy.mode, "rule");
  assert.equal(policy.rules[0].action.target, "US");
  assert.equal(validateRoutingPolicy(policy).ok, true);
});

test("routing policy rejects malformed or duplicate rules", () => {
  const policy = createRoutingPolicy({
    rules: [
      {
        id: "same",
        name: "one",
        match: { domain: ["a.example"] },
        action: { type: "route", target: "US" }
      },
      {
        id: "same",
        name: "two",
        match: { domain: ["b.example"] },
        action: { type: "route", target: "JP" }
      }
    ]
  });

  const result = validateRoutingPolicy(policy);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("duplicate routing rule id")));
});

test("routing policy preserves explicit reject, DNS and chain actions", () => {
  for (const action of [
    { type: "reject" },
    { type: "dns", target: "secure-dns" },
    { type: "chain", target: "A-to-B" }
  ]) {
    const rule = createRoutingRule({
      id: action.type,
      name: action.type,
      match: { network: ["tcp"] },
      action
    });
    assert.equal(rule.action.type, action.type);
  }
});


test("routing policy requires an explicit target for bypass", () => {
  assert.throws(() => createRoutingRule({
    id: "domestic",
    name: "Domestic",
    match: { geoip: ["CN"] },
    action: { type: "bypass" }
  }), /routing action target must be a non-empty string/);
});
