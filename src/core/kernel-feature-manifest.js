import { Kernels } from "./model.js";

export const FeatureStatus = Object.freeze({
  SUPPORTED: "supported",
  UNSUPPORTED: "unsupported",
  UNKNOWN: "unknown"
});

// Parameter/combination capabilities are explicit data, separate from compilation.
// Only maintained, reviewed combinations are marked supported.
export const KernelFeatureManifest = Object.freeze({
  [Kernels.MIHOMO]: Object.freeze({
    "tls.reality": Object.freeze({ protocols: ["vless", "vmess", "trojan"], transports: ["tcp", "ws", "grpc"] }),
    "transport.websocket": Object.freeze({ protocols: ["vless", "vmess", "trojan", "shadowsocks"] }),
    "transport.grpc": Object.freeze({ protocols: ["vless", "vmess", "trojan"] }),
    "transport.quic": Object.freeze({ protocols: ["vless", "vmess", "trojan"] }),
    "multiplex": Object.freeze({ protocols: ["vless", "vmess", "trojan", "shadowsocks", "hysteria2", "tuic"] })
  }),
  [Kernels.SING_BOX]: Object.freeze({
    "tls.reality": Object.freeze({ protocols: ["vless", "vmess", "trojan"] }),
    "transport.websocket": Object.freeze({ protocols: ["vless", "vmess", "trojan", "shadowsocks"] }),
    "transport.grpc": Object.freeze({ protocols: ["vless", "vmess", "trojan"] }),
    "transport.quic": Object.freeze({ protocols: ["vless", "vmess", "trojan"] }),
    "multiplex": Object.freeze({ protocols: ["vless", "vmess", "trojan", "shadowsocks", "hysteria2", "tuic"] })
  }),
  [Kernels.XRAY]: Object.freeze({
    "tls.reality": Object.freeze({ protocols: ["vless", "vmess", "trojan"] }),
    "transport.websocket": Object.freeze({ protocols: ["vless", "vmess", "trojan", "shadowsocks"] }),
    "transport.grpc": Object.freeze({ protocols: ["vless", "vmess", "trojan"] }),
    "transport.quic": Object.freeze({ protocols: ["vless", "vmess", "trojan"] })
  })
});

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function featureOf(node) {
  const tls = node && node.tls && typeof node.tls === "object" ? node.tls : {};
  const transport = node && node.transport && typeof node.transport === "object" ? node.transport : {};
  const features = [];
  if (tls.reality && typeof tls.reality === "object" ? tls.reality.enabled !== false : tls.reality === true) features.push(["tls.reality", null]);
  const transportType = normalize(node.network || transport.type);
  if (transportType) features.push(["transport." + transportType, transportType]);
  if (node.multiplex === true || node.mux === true || (node.multiplex && typeof node.multiplex === "object" && node.multiplex.enabled !== false)) {
    features.push(["multiplex", null]);
  }
  return features;
}

export function evaluateKernelFeatures(kernel, node = {}) {
  if (!KernelFeatureManifest[kernel]) throw new Error("unsupported kernel: " + kernel);
  const protocol = normalize(node.protocol || node.type);
  const results = [];

  for (const [feature, transport] of featureOf(node)) {
    const rule = KernelFeatureManifest[kernel][feature];
    if (!rule) {
      results.push({ feature, status: FeatureStatus.UNKNOWN, reason: "feature is not established in the maintained manifest" });
      continue;
    }
    if (!rule.protocols.includes(protocol)) {
      results.push({ feature, status: FeatureStatus.UNSUPPORTED, protocol, transport, reason: "feature/protocol combination is not supported by the maintained manifest" });
      continue;
    }
    if (rule.transports && transport && !rule.transports.includes(transport)) {
      results.push({ feature, status: FeatureStatus.UNSUPPORTED, protocol, transport, reason: "feature/transport combination is not supported by the maintained manifest" });
      continue;
    }
    results.push({ feature, status: FeatureStatus.SUPPORTED, protocol, transport });
  }

  return {
    kernel,
    protocol: protocol || null,
    ok: results.every(item => item.status === FeatureStatus.SUPPORTED),
    features: results
  };
}

export function validateKernelFeatures(kernel, nodes = []) {
  const results = [];
  for (const node of Array.isArray(nodes) ? nodes : []) {
    const evaluated = evaluateKernelFeatures(kernel, node);
    if (evaluated.features.length) results.push({ id: node.id || node.name || null, ...evaluated });
  }
  const errors = results.flatMap(item => item.features.filter(feature => feature.status === FeatureStatus.UNSUPPORTED));
  const unknown = results.flatMap(item => item.features.filter(feature => feature.status === FeatureStatus.UNKNOWN));
  return { kernel, ok: errors.length === 0 && unknown.length === 0, results, errors, unknown };
}
