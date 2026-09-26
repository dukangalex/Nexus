import test from "node:test";
import assert from "node:assert/strict";
import { evaluateKernelFeatures, validateKernelFeatures } from "../src/core/kernel-feature-manifest.js";
import { Kernels } from "../src/core/model.js";

test("accepts a maintained feature/protocol combination", () => {
  const result = evaluateKernelFeatures(Kernels.MIHOMO, {
    protocol: "vless",
    tls: { reality: { enabled: true } },
    transport: { type: "grpc" }
  });
  assert.equal(result.ok, true);
  assert.equal(result.features.every((item) => item.status === "supported"), true);
});

test("rejects an unmaintained feature/protocol combination", () => {
  const result = evaluateKernelFeatures(Kernels.XRAY, {
    protocol: "wireguard",
    tls: { reality: { enabled: true } }
  });
  assert.equal(result.ok, false);
  assert.equal(result.features[0].status, "unsupported");
});

test("reports unknown features instead of silently assuming support", () => {
  const result = evaluateKernelFeatures(Kernels.SING_BOX, {
    protocol: "vless",
    transport: { type: "future-transport" }
  });
  assert.equal(result.ok, false);
  assert.equal(result.features[0].status, "unknown");
});

test("validates feature constraints across nodes", () => {
  const result = validateKernelFeatures(Kernels.MIHOMO, [{
    name: "node-1",
    protocol: "vless",
    tls: { reality: { enabled: true } }
  }]);
  assert.equal(result.ok, true);
});

test("normalizes websocket alias used by canonical nodes", () => {
  const result = evaluateKernelFeatures(Kernels.MIHOMO, {
    protocol: "vless",
    transport: { type: "ws" }
  });
  assert.equal(result.ok, true);
  assert.equal(result.features[0].feature, "transport.websocket");
});

test("accepts sing-box Hysteria gRPC transport", () => {
  const result = evaluateKernelFeatures(Kernels.SING_BOX, {
    protocol: "hysteria",
    transport: { type: "grpc", serviceName: "proxy" }
  });
  assert.equal(result.ok, true);
  assert.equal(result.features[0].status, "supported");
});
