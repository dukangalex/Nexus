import test from "node:test";
import assert from "node:assert/strict";
import {
  compileRoutingPolicy,
  validateRoutingForKernel
} from "../src/core/routing-compiler.js";

function policy(match, action) {
  return {
    version: 1,
    mode: "rule",
    rules: [{
      id: "r1",
      name: "rule",
      enabled: true,
      order: 1,
      match,
      action
    }],
    strategies: [],
    defaultAction: { type: "route", target: "default" }
  };
}

test("common routing policy compiles explicitly for all three kernels", () => {
  const p = policy({ domain_suffix: ["google.com"] }, { type: "route", target: "Google" });

  assert.deepEqual(compileRoutingPolicy(p, "mihomo"), [["DOMAIN-SUFFIX", "google.com", "Google"]]);
  assert.deepEqual(compileRoutingPolicy(p, "sing-box"), [{
    domain_suffix: ["google.com"],
    action: "route",
    outbound: "Google"
  }]);
  assert.deepEqual(compileRoutingPolicy(p, "xray"), [{
    type: "field",
    domain: ["domain:google.com"],
    outboundTag: "Google"
  }]);
});

test("reject and bypass remain explicit kernel actions", () => {
  assert.deepEqual(
    compileRoutingPolicy(policy({ domain: ["ads.example"] }, { type: "reject" }), "mihomo"),
    [["DOMAIN", "ads.example", "REJECT"]]
  );
  assert.deepEqual(
    compileRoutingPolicy(policy({ domain: ["ads.example"] }, { type: "reject" }), "sing-box"),
    [{ domain: ["ads.example"], action: "reject" }]
  );
  assert.deepEqual(
    compileRoutingPolicy(policy({ domain: ["local.example"] }, { type: "bypass" }), "xray"),
    [{ type: "field", domain: ["local.example"], outboundTag: "__nexus_direct" }]
  );
});

test("unsupported kernel-specific match is rejected instead of silently degraded", () => {
  const p = policy({ process_name: ["browser"] }, { type: "route", target: "Proxy" });
  assert.equal(validateRoutingForKernel(p, "xray").ok, false);
  assert.throws(() => compileRoutingPolicy(p, "xray"), /does not support routing match/);
});
