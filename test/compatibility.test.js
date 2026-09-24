import test from "node:test";
import assert from "node:assert/strict";
import { Kernels } from "../src/core/model.js";
import { CompatibilityStatus, protocolCompatibility, validateUnifiedCompatibility } from "../src/core/compatibility.js";

test("recognizes documented common protocols", () => {
  assert.equal(protocolCompatibility(Kernels.MIHOMO, "ss").status, CompatibilityStatus.SUPPORTED);
  assert.equal(protocolCompatibility(Kernels.SING_BOX, "vless").status, CompatibilityStatus.SUPPORTED);
  assert.equal(protocolCompatibility(Kernels.XRAY, "vmess").status, CompatibilityStatus.SUPPORTED);
});

test("does not claim Xray supports Hysteria2", () => {
  const result = protocolCompatibility(Kernels.XRAY, "hysteria2");
  assert.equal(result.status, CompatibilityStatus.UNKNOWN);
});

test("validates every unified node before compilation", () => {
  const result = validateUnifiedCompatibility({
    kernel: Kernels.XRAY,
    nodes: [
      { id: "v1", protocol: "vless" },
      { id: "h2", protocol: "hysteria2" }
    ]
  });
  assert.equal(result.ok, false);
  assert.equal(result.unknown.length, 1);
  assert.equal(result.unknown[0].id, "h2");
});
