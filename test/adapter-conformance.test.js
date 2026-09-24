import test from "node:test";
import assert from "node:assert/strict";
import { Kernels } from "../src/core/model.js";
import { adapterFor } from "../src/adapters/index.js";
import { compileUnifiedConfig } from "../src/core/config-compiler.js";

const cases = [
  { kernel: Kernels.MIHOMO, node: { id: "basic", protocol: "socks", server: "example.com", port: 1080 } },
  { kernel: Kernels.MIHOMO, node: { id: "hy2", protocol: "hysteria2", server: "example.com", port: 443, password: "p", tls: { enabled: true } } },
  { kernel: Kernels.MIHOMO, node: { id: "anytls", protocol: "anytls", server: "example.com", port: 443, password: "p", tls: { enabled: true } } },
  { kernel: Kernels.SING_BOX, node: { id: "basic", protocol: "socks", server: "example.com", port: 1080 } },
  { kernel: Kernels.SING_BOX, node: { id: "hy", protocol: "hysteria", server: "example.com", port: 443, password: "p", tls: { enabled: true } } },
  { kernel: Kernels.SING_BOX, node: { id: "hy2", protocol: "hysteria2", server: "example.com", port: 443, password: "p", tls: { enabled: true } } },
  { kernel: Kernels.SING_BOX, node: { id: "tuic", protocol: "tuic", server: "example.com", port: 443, uuid: "00000000-0000-0000-0000-000000000001", password: "p", tls: { enabled: true } } },
  { kernel: Kernels.SING_BOX, node: { id: "anytls", protocol: "anytls", server: "example.com", port: 443, password: "p", tls: { enabled: true } } },
  { kernel: Kernels.XRAY, node: { id: "basic", protocol: "socks", server: "example.com", port: 1080 } },
  { kernel: Kernels.XRAY, node: { id: "hy", protocol: "hysteria", server: "example.com", port: 443, tls: { enabled: true } } }
];

for (const item of cases) {
  test(item.kernel + " adapter conformance: compile " + item.node.protocol, () => {
    const adapter = adapterFor(item.kernel);
    assert.ok(adapter);
    assert.ok(adapter.capabilities.includes("config-compile"));
    const result = compileUnifiedConfig({ kernel: item.kernel, nodes: [item.node] });
    assert.equal(result.status, "compiled");
    assert.equal(result.compatibility.status, "supported");
    assert.equal(result.validation.ok, true);
  });
}

test("adapter conformance matrix has no shared implementation object", () => {
  const mihomo = adapterFor(Kernels.MIHOMO);
  const singBox = adapterFor(Kernels.SING_BOX);
  const xray = adapterFor(Kernels.XRAY);
  assert.notEqual(mihomo, singBox);
  assert.notEqual(mihomo, xray);
  assert.notEqual(singBox, xray);
  assert.notEqual(mihomo.compileConfig, singBox.compileConfig);
  assert.notEqual(mihomo.compileConfig, xray.compileConfig);
  assert.notEqual(singBox.compileConfig, xray.compileConfig);
});


test("Xray VLESS Reality compiles using current realitySettings client fields", () => {
  const result = compileUnifiedConfig({
    kernel: Kernels.XRAY,
    nodes: [{
      id: "x-reality",
      protocol: "vless",
      server: "example.com",
      port: 443,
      uuid: "00000000-0000-0000-0000-000000000001",
      tls: {
        enabled: true,
        serverName: "example.com",
        fingerprint: "chrome",
        reality: {
          enabled: true,
          publicKey: "test-public-key",
          shortId: "01234567"
        }
      },
      transport: { type: "grpc", serviceName: "proxy" }
    }]
  });
  const reality = result.config.outbounds[0].streamSettings.realitySettings;
  assert.equal(reality.password, "test-public-key");
  assert.equal(reality.fingerprint, "chrome");
  assert.equal(reality.shortId, "01234567");
  assert.equal(result.validation.ok, true);
});


test("Xray Reality does not invent a missing fingerprint", () => {
  assert.throws(() => compileUnifiedConfig({
    kernel: Kernels.XRAY,
    nodes: [{
      id: "x-reality-missing-fingerprint",
      protocol: "vless",
      server: "example.com",
      port: 443,
      uuid: "00000000-0000-0000-0000-000000000001",
      tls: {
        enabled: true,
        serverName: "example.com",
        reality: {
          enabled: true,
          publicKey: "test-public-key",
          shortId: "01234567"
        }
      },
      transport: { type: "grpc", serviceName: "proxy" }
    }]
  }), /Reality requires fingerprint/);
});

test("Mihomo Reality enables TLS even when tls.enabled is omitted", () => {
  const result = compileUnifiedConfig({
    kernel: Kernels.MIHOMO,
    nodes: [{
      id: "mihomo-reality",
      protocol: "vless",
      server: "example.com",
      port: 443,
      uuid: "00000000-0000-0000-0000-000000000001",
      tls: {
        serverName: "example.com",
        fingerprint: "chrome",
        reality: {
          enabled: true,
          publicKey: "test-public-key",
          shortId: "01234567"
        }
      }
    }]
  });
  assert.equal(result.config.proxies[0].tls, true);
  assert.equal(result.validation.ok, true);
});


test("sing-box Hysteria compiles auth_str and nested transport fields", () => {
  const result = compileUnifiedConfig({
    kernel: Kernels.SING_BOX,
    nodes: [{
      id: "hy",
      protocol: "hysteria",
      server: "example.com",
      port: 443,
      password: "secret",
      tls: { enabled: true },
      transport: { type: "grpc", serviceName: "proxy" }
    }]
  });
  const outbound = result.config.outbounds[0];
  assert.equal(outbound.auth_str, "secret");
  assert.equal(outbound.password, undefined);
  assert.deepEqual(outbound.transport, { type: "grpc", service_name: "proxy" });
  assert.equal(outbound.service_name, undefined);
});
