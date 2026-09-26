import test from "node:test";
import assert from "node:assert/strict";
import { compileMihomoConfig } from "../src/adapters/mihomo/compiler.js";
import { compileSingBoxConfig } from "../src/adapters/sing-box/compiler.js";
import { compileXrayConfig } from "../src/adapters/xray/compiler.js";

const routing = {
  rules: [{
    id: "google",
    name: "Google",
    match: { domain_suffix: ["google.com"] },
    action: { type: "route", target: "US" },
    order: 10
  }],
  strategies: [],
  defaultAction: { type: "route", target: "US" }
};

test("Mihomo adapter compiles unified routing and explicit default", () => {
  const output = compileMihomoConfig({ nodes: [], groups: [], routing });
  assert.deepEqual(output.rules, ["DOMAIN-SUFFIX,google.com,US", "MATCH,US"]);
});

test("sing-box adapter compiles unified routing and explicit final", () => {
  const output = compileSingBoxConfig({ nodes: [], groups: [], routing });
  assert.deepEqual(output.route.rules, [{
    domain_suffix: ["google.com"],
    action: "route",
    outbound: "US"
  }]);
  assert.equal(output.route.final, "US");
});

test("Xray adapter compiles unified routing and explicit default", () => {
  const output = compileXrayConfig({ nodes: [], routing });
  assert.deepEqual(output.routing.rules, [
    { inboundTag: ["Nexus-DNS"], outboundTag: "US", ruleTag: "Nexus-DNS-Route" },
    { domain: ["domain:google.com"], outboundTag: "US", ruleTag: "Google" },
    { network: "tcp,udp", outboundTag: "US", ruleTag: "Nexus-default" }
  ]);
});
