import test from "node:test";
import assert from "node:assert/strict";
import { compileUnifiedConfig } from "../src/core/config-compiler.js";
import { Kernels } from "../src/core/model.js";

test("compiles unified groups to Mihomo and rewrites route targets", () => {
  const result = compileUnifiedConfig({
    kernel: Kernels.MIHOMO,
    nodes: [
      { id: "us-1", protocol: "socks", server: "us.example", port: 1080 },
      { id: "us-2", protocol: "socks", server: "us2.example", port: 1080 }
    ],
    groups: [{ id: "us", name: "US Auto", type: "url_test", members: ["us-1", "us-2"], options: { url: "https://example.com/generate_204", interval: 300 } }],
    routing: { rules: [{ id: "r", name: "group", order: 1, match: { domain_suffix: ["example.com"] }, action: { type: "route", target: "us" } }] }
  });
  assert.equal(result.config["proxy-groups"][0].name, "US Auto");
  assert.deepEqual(result.config["proxy-groups"][0].proxies, ["us-1", "us-2"]);
  assert.equal(result.config["proxy-groups"][0].type, "url-test");
  assert.equal(result.config.rules[0], "DOMAIN-SUFFIX,example.com,US Auto");
  assert.equal(result.groups[0].target, "US Auto");
});

test("compiles unified groups to sing-box without leaking canonical fields", () => {
  const result = compileUnifiedConfig({
    kernel: Kernels.SING_BOX,
    nodes: [{ id: "a", protocol: "socks", server: "a.example", port: 1080 }, { id: "b", protocol: "socks", server: "b.example", port: 1080 }],
    groups: [{ id: "auto", name: "Auto", type: "load_balance", members: ["a", "b"], options: { strategy: "random" } }]
  });
  const group = result.config.outbounds.find((outbound) => outbound.tag === "auto");
  assert.equal(group.type, "loadbalance");
  assert.deepEqual(group.outbounds, ["a", "b"]);
  assert.equal(group.strategy, "random");
  assert.equal(group.id, undefined);
  assert.equal(group.members, undefined);
});

test("rejects Xray groups instead of silently downgrading their semantics", () => {
  assert.throws(() => compileUnifiedConfig({
    kernel: Kernels.XRAY,
    nodes: [{ id: "a", protocol: "socks", server: "a.example", port: 1080 }, { id: "b", protocol: "socks", server: "b.example", port: 1080 }],
    groups: [{ id: "auto", name: "Auto", type: "select", members: ["a", "b"] }]
  }), /Xray does not support unified group type without semantic downgrade: select/);
});


test("rewrites node route targets to kernel-visible names and fails closed on unknown targets", () => {
  const result = compileUnifiedConfig({
    kernel: Kernels.MIHOMO,
    nodes: [{ id: "node-1", name: "US 01", protocol: "socks", server: "us.example", port: 1080 }],
    routing: { rules: [{ id: "r", name: "node", order: 1, match: { domain: ["example.com"] }, action: { type: "route", target: "node-1" } }] }
  });
  assert.equal(result.config.rules[0], "DOMAIN,example.com,US 01");

  assert.throws(() => compileUnifiedConfig({
    kernel: Kernels.MIHOMO,
    nodes: [{ id: "node-1", protocol: "socks", server: "us.example", port: 1080 }],
    routing: { defaultAction: { type: "route", target: "missing" } }
  }), /routing references missing node or group: missing/);
});
