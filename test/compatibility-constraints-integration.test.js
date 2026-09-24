import test from "node:test";
import assert from "node:assert/strict";
import { Kernels, NodeProtocols } from "../src/core/model.js";
import { validateUnifiedCompatibility } from "../src/core/compatibility.js";
import { compileUnifiedConfig } from "../src/core/config-compiler.js";

test("unified compatibility exposes verified combination errors", () => {
  const result = validateUnifiedCompatibility({
    kernel: Kernels.MIHOMO,
    nodes: [{
      id: "anytls-reality",
      protocol: NodeProtocols.ANYTLS,
      tls: { reality: { enabled: true } }
    }]
  }, Kernels.MIHOMO);

  assert.equal(result.ok, false);
  assert.ok(result.constraintErrors.some((item) =>
    item.code === "MIHOMO_ANYTLS_REALITY_UNSUPPORTED"
  ));
});

test("compiler blocks unsafe combination before adapter compilation", () => {
  assert.throws(() => compileUnifiedConfig({
    kernel: Kernels.MIHOMO,
    nodes: [{
      id: "anytls-reality",
      protocol: NodeProtocols.ANYTLS,
      server: "example.com",
      port: 443,
      password: "p",
      tls: { reality: { enabled: true } }
    }]
  }), /MIHOMO_ANYTLS_REALITY_UNSUPPORTED/);
});

test("compiler preserves compatibility evidence for safe nodes", () => {
  const result = compileUnifiedConfig({
    kernel: Kernels.SING_BOX,
    nodes: [{
      id: "socks-1",
      protocol: NodeProtocols.SOCKS,
      server: "example.com",
      port: 1080
    }]
  });

  assert.equal(result.compatibility.ok, true);
  assert.equal(result.compatibility.constraintErrors.length, 0);
  assert.equal(result.status, "compiled");
});


test("current sing-box Reality remains supported and compiles", () => {
  const result = compileUnifiedConfig({
    kernel: Kernels.SING_BOX,
    nodes: [{
      id: "v-reality",
      protocol: NodeProtocols.VLESS,
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
      }
    }]
  });

  assert.equal(result.compatibility.ok, true);
  assert.equal(result.validation.ok, true);
  assert.equal(result.config.outbounds[0].tls.reality.enabled, true);
  assert.equal(result.config.outbounds[0].tls.reality.public_key, "test-public-key");
});
