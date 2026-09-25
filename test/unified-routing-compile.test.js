import test from "node:test";
import assert from "node:assert/strict";
import { compileUnifiedConfig } from "../src/core/config-compiler.js";

function config() {
  return {
    version: 1,
    nodes: [{
      id: "us-1",
      name: "US-1",
      protocol: "socks",
      endpoint: { server: "127.0.0.1", port: 1080 }
    }],
    groups: [],
    subscriptions: [],
    dns: {},
    security: {},
    chains: [],
    platform: {},
    routing: {
      version: 1,
      mode: "rule",
      rules: [{
        id: "google",
        name: "Google",
        enabled: true,
        order: 10,
        match: { domain_suffix: ["google.com"] },
        action: { type: "route", target: "US-1" }
      }],
      strategies: [],
      defaultAction: { type: "route", target: "US-1" }
    }
  };
}

for (const kernel of ["mihomo", "sing-box", "xray"]) {
  test("unified routing compiles for " + kernel, () => {
    const result = compileUnifiedConfig(config(), kernel);
    assert.equal(result.status, "compiled");
    assert.equal(result.validation.ok, true);

    if (kernel === "mihomo") {
      assert.deepEqual(result.config.rules, [["DOMAIN-SUFFIX", "google.com", "US-1"]]);
    } else if (kernel === "sing-box") {
      assert.equal(result.config.route.rules[0].domain_suffix[0], "google.com");
      assert.equal(result.config.route.rules[0].outbound, "US-1");
    } else {
      assert.deepEqual(result.config.routing.rules[0].domain, ["domain:google.com"]);
      assert.equal(result.config.routing.rules[0].outboundTag, "US-1");
    }
  });
}

test("Xray receives explicit direct and block outbounds for unified bypass/reject", () => {
  const source = config();
  source.routing.rules = [
    {
      id: "local",
      name: "Local",
      enabled: true,
      order: 1,
      match: { domain: ["local.example"] },
      action: { type: "bypass" }
    },
    {
      id: "ads",
      name: "Ads",
      enabled: true,
      order: 2,
      match: { domain: ["ads.example"] },
      action: { type: "reject" }
    }
  ];

  const result = compileUnifiedConfig(source, "xray");
  assert.ok(result.config.outbounds.some((item) => item.tag === "__nexus_direct"));
  assert.ok(result.config.outbounds.some((item) => item.tag === "__nexus_block"));
});
