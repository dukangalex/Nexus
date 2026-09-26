import test from "node:test";
import assert from "node:assert/strict";
import { Kernels } from "../src/core/model.js";
import { compileRoutingPolicy } from "../src/core/routing-compiler.js";

const policy = {
  mode: "rule",
  rules: [
    {
      id: "google",
      name: "Google",
      match: { domain_suffix: ["google.com"] },
      action: { type: "route", target: "US" },
      order: 10
    },
    {
      id: "ads",
      name: "Ads",
      match: { geosite: ["category-ads-all"] },
      action: { type: "reject" },
      order: 20
    }
  ],
  strategies: [],
  defaultAction: { type: "route", target: "US" }
};

test("unified routing compiles explicitly to Mihomo", () => {
  assert.deepEqual(compileRoutingPolicy(policy, Kernels.MIHOMO), [
    "DOMAIN-SUFFIX,google.com,US",
    "GEOSITE,category-ads-all,REJECT"
  ]);
});

test("unified routing compiles explicitly to sing-box", () => {
  assert.deepEqual(compileRoutingPolicy(policy, Kernels.SING_BOX), [
    {
      domain_suffix: ["google.com"],
      action: "route",
      outbound: "US"
    },
    {
      geosite: ["category-ads-all"],
      action: "reject"
    }
  ]);
});

test("unified routing compiles explicitly to Xray", () => {
  assert.deepEqual(compileRoutingPolicy(policy, Kernels.XRAY), [
    {
      domain: ["domain:google.com"],
      outboundTag: "US",
      ruleTag: "Google"
    },
    {
      domain: ["geosite:category-ads-all"],
      outboundTag: "Nexus-Blackhole",
      ruleTag: "Ads"
    }
  ]);
});


test("bypass action is normalized to managed direct routing across kernels", () => {
  const bypassPolicy = {
    mode: "rule",
    rules: [{
      id: "domestic",
      name: "Domestic",
      match: { geoip: ["CN"] },
      action: { type: "bypass", target: "Nexus-Direct" },
      order: 10
    }],
    strategies: [],
    defaultAction: { type: "route", target: "US" }
  };

  assert.deepEqual(compileRoutingPolicy(bypassPolicy, Kernels.MIHOMO), [
    "GEOIP,CN,Nexus-Direct"
  ]);
  assert.deepEqual(compileRoutingPolicy(bypassPolicy, Kernels.SING_BOX), [{
    geoip: ["CN"],
    action: "route",
    outbound: "Nexus-Direct"
  }]);
  assert.deepEqual(compileRoutingPolicy(bypassPolicy, Kernels.XRAY), [{
    ip: ["geoip:CN"],
    outboundTag: "Nexus-Direct",
    ruleTag: "Domestic"
  }]);
});
