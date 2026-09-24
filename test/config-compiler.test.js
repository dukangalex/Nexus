import test from "node:test";
import assert from "node:assert/strict";
import { compileUnifiedConfig } from "../src/core/config-compiler.js";
import { Kernels } from "../src/core/model.js";
import { validateCompiledConfig } from "../src/core/compiled-config-validation.js";

test("compiles a simple unified node to Mihomo", () => {
  const result = compileUnifiedConfig({
    kernel: Kernels.MIHOMO,
    nodes: [{ id: "us-1", name: "us-1", protocol: "socks", server: "example.com", port: 1080 }],
    groups: [],
    dns: {},
    routing: {}
  });
  assert.equal(result.status, "compiled");
  assert.equal(result.config.proxies[0].name, "us-1");
  assert.equal(result.config.proxies[0].port, 1080);
  assert.equal(result.validation.ok, true);
});

test("compiles a simple unified node to sing-box", () => {
  const result = compileUnifiedConfig({
    kernel: Kernels.SING_BOX,
    nodes: [{ id: "us-1", name: "us-1", protocol: "socks", server: "example.com", port: 1080 }],
    groups: [],
    dns: {},
    routing: {}
  });
  assert.equal(result.config.outbounds[0].tag, "us-1");
  assert.equal(result.config.outbounds[0].server_port, 1080);
});

test("refuses an unverified protocol instead of silently degrading", () => {
  assert.throws(() => compileUnifiedConfig({
    kernel: Kernels.XRAY,
    nodes: [{ id: "h2", name: "h2", protocol: "hysteria2", server: "example.com", port: 443 }]
  }), /not safely compilable/);
});
