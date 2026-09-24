import test from "node:test";
import assert from "node:assert/strict";
import { Kernels, NodeProtocols } from "../src/core/model.js";
import { ConstraintSeverity, validateNodeCombination, validateNodeCombinations } from "../src/core/combination-constraints.js";

test("Mihomo rejects AnyTLS with Reality", () => {
  const issues = validateNodeCombination(Kernels.MIHOMO, { protocol: NodeProtocols.ANYTLS, tls: { reality: { enabled: true } } });
  assert.equal(issues[0].code, "MIHOMO_ANYTLS_REALITY_UNSUPPORTED");
  assert.equal(issues[0].severity, ConstraintSeverity.ERROR);
});

test("Xray rejects Hysteria with Reality", () => {
  const issues = validateNodeCombination(Kernels.XRAY, { protocol: NodeProtocols.HYSTERIA, version: 2, tls: { reality: { enabled: true } } });
  assert.ok(issues.some(item => item.code === "XRAY_HYSTERIA_REALITY_UNSUPPORTED"));
});

test("Xray restricts Reality transport", () => {
  const issues = validateNodeCombination(Kernels.XRAY, { protocol: NodeProtocols.VLESS, network: "ws", tls: { reality: { enabled: true } } });
  assert.ok(issues.some(item => item.code === "XRAY_REALITY_TRANSPORT"));
});

test("Xray accepts VLESS Reality over gRPC", () => {
  assert.equal(validateNodeCombination(Kernels.XRAY, { protocol: NodeProtocols.VLESS, network: "grpc", tls: { reality: { enabled: true } } }).length, 0);
});

test("warnings do not fail validation", () => {
  const result = validateNodeCombinations(Kernels.XRAY, [{ id: "h", protocol: NodeProtocols.HYSTERIA, version: 2, network: "ws" }]);
  assert.equal(result.errors.length, 0);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.ok, true);
});
