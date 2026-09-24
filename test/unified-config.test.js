import test from "node:test";
import assert from "node:assert/strict";
import { Kernels } from "../src/core/model.js";
import { createUnifiedConfig, toUnifiedConfig, isUnifiedConfig, nodeCount } from "../src/core/unified-config.js";

test("creates a kernel-neutral unified config", () => {
  const config = createUnifiedConfig({
    sourceFormat: "sing-box-json",
    kernel: Kernels.SING_BOX,
    nodes: [{ tag: "us-1", type: "vless", server: "example.com" }],
    groups: [{ type: "selector", tag: "proxy", outbounds: ["us-1"] }],
    routing: { rules: [] },
    dns: { servers: [] }
  });

  assert.equal(config.version, 1);
  assert.equal(config.kernel, Kernels.SING_BOX);
  assert.equal(config.nodes[0].id, "us-1");
  assert.equal(config.groups.length, 1);
  assert.equal(isUnifiedConfig(config), true);
  assert.equal(nodeCount(config), 1);
});

test("maps Mihomo-style configuration into the unified model", () => {
  const config = toUnifiedConfig({
    proxies: [
      { name: "hk-1", type: "ss", server: "example.com" }
    ],
    "proxy-groups": [
      { name: "Proxy", type: "select", proxies: ["hk-1"] }
    ],
    dns: { enable: true }
  }, {
    sourceFormat: "clash-yaml",
    kernel: Kernels.MIHOMO
  });

  assert.equal(config.kernel, Kernels.MIHOMO);
  assert.equal(config.nodes.length, 1);
  assert.equal(config.groups.length, 1);
  assert.equal(config.dns.enable, true);
});

test("maps Xray routing and outbounds without treating groups as nodes", () => {
  const config = toUnifiedConfig({
    inbounds: [],
    outbounds: [
      { tag: "proxy", protocol: "vless", settings: {} },
      { tag: "direct", protocol: "freedom", settings: {} }
    ],
    routing: { rules: [] }
  }, {
    sourceFormat: "xray-json",
    kernel: Kernels.XRAY
  });

  assert.equal(config.nodes.length, 2);
  assert.equal(config.routing.rules.length, 0);
  assert.equal(config.groups.length, 0);
});

test("rejects invalid kernel bindings instead of inventing one", () => {
  const config = createUnifiedConfig({ kernel: "unknown" });
  assert.equal(config.kernel, null);
});
