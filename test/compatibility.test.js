import test from "node:test";
import assert from "node:assert/strict";
import { Kernels } from "../src/core/model.js";
import { CompatibilityStatus, protocolCompatibility, validateUnifiedCompatibility, buildCompatibilityMatrix } from "../src/core/compatibility.js";

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
  const result = validateUnifiedCompatibility({ kernel: Kernels.XRAY, nodes: [{ id: "v1", protocol: "vless" }, { id: "h2", protocol: "hysteria2" }] });
  assert.equal(result.ok, false);
  assert.equal(result.unknown.length, 1);
  assert.equal(result.unknown[0].id, "h2");
});

test("builds a user-visible cross-kernel capability matrix", () => {
  const matrix = buildCompatibilityMatrix(["vless", "hysteria2", "tuic", "anytls", "wireguard"]);
  const h2 = matrix.find(row => row.protocol === "hysteria2");
  const wg = matrix.find(row => row.protocol === "wireguard");
  assert.equal(h2["sing-box"].status, CompatibilityStatus.SUPPORTED);
  assert.equal(h2.xray.status, CompatibilityStatus.UNKNOWN);
  assert.equal(wg["sing-box"].status, CompatibilityStatus.SUPPORTED);
  assert.equal(wg.xray.status, CompatibilityStatus.SUPPORTED);
});