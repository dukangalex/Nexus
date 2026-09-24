import { Kernels } from "./model.js";

export const CompatibilityStatus = Object.freeze({
  SUPPORTED: "supported",
  UNSUPPORTED: "unsupported",
  UNKNOWN: "unknown"
});

// Baseline reviewed against upstream documentation/releases on 2026-09-24.
// Stable: Mihomo v1.19.31, sing-box v1.14.2, Xray v26.9.8.
// Pre-release tracks are intentionally not used as the production baseline:
// Mihomo Alpha and sing-box 1.15.0-alpha.6 / Xray 26.9.9 are tracked separately.
export const KernelVersions = Object.freeze({
  [Kernels.MIHOMO]: Object.freeze({ stable: "1.19.31", channel: "stable" }),
  [Kernels.SING_BOX]: Object.freeze({ stable: "1.14.2", channel: "stable", preview: "1.15.0-alpha.6" }),
  [Kernels.XRAY]: Object.freeze({ stable: "26.9.8", channel: "stable", preview: "26.9.9" })
});

const PROTOCOLS = Object.freeze({
  mihomo: new Set(["http", "socks", "shadowsocks", "vmess", "vless", "trojan", "wireguard", "tuic", "hysteria2", "anytls"]),
  "sing-box": new Set(["http", "socks", "shadowsocks", "vmess", "vless", "trojan", "wireguard", "hysteria", "hysteria2", "tuic", "anytls"]),
  xray: new Set(["http", "socks", "shadowsocks", "vmess", "vless", "trojan", "wireguard", "hysteria"])
});

const KNOWN_UNSUPPORTED = Object.freeze({
  mihomo: new Set([]),
  "sing-box": new Set([]),
  xray: new Set(["hysteria2", "tuic", "anytls"])
});

const EVIDENCE = Object.freeze({
  mihomo: "https://wiki.metacubex.one/en/config/proxies/",
  "sing-box": "https://sing-box.sagernet.org/configuration/outbound/",
  xray: "https://xtls.github.io/en/config/outbounds/"
});

function normalizeProtocol(protocol) {
  const value = String(protocol || "").trim().toLowerCase();
  if (value === "ss") return "shadowsocks";
  if (value === "hy2") return "hysteria2";
  return value;
}

export function protocolCompatibility(kernel, protocol) {
  if (!Object.values(Kernels).includes(kernel)) throw new Error("unsupported kernel: " + kernel);
  const normalized = normalizeProtocol(protocol);
  if (!normalized) return { kernel, protocol: null, status: CompatibilityStatus.UNKNOWN, reason: "node protocol is missing", evidence: EVIDENCE[kernel], version: KernelVersions[kernel] };
  if (KNOWN_UNSUPPORTED[kernel].has(normalized)) return { kernel, protocol: normalized, status: CompatibilityStatus.UNSUPPORTED, reason: "upstream kernel does not expose this outbound protocol", evidence: EVIDENCE[kernel], version: KernelVersions[kernel] };
  if (PROTOCOLS[kernel].has(normalized)) return { kernel, protocol: normalized, status: CompatibilityStatus.SUPPORTED, reason: "verified in the maintained upstream outbound documentation", evidence: EVIDENCE[kernel], version: KernelVersions[kernel] };
  return { kernel, protocol: normalized, status: CompatibilityStatus.UNKNOWN, reason: "not established by the maintained compatibility registry", evidence: EVIDENCE[kernel], version: KernelVersions[kernel] };
}

export function validateUnifiedCompatibility(config, kernel = config && config.kernel) {
  if (!config || typeof config !== "object") throw new TypeError("unified configuration is required");
  if (!Object.values(Kernels).includes(kernel)) throw new Error("unsupported kernel: " + kernel);
  const nodes = Array.isArray(config.nodes) ? config.nodes : [];
  const results = nodes.map((node) => ({ id: node.id || node.name || null, ...protocolCompatibility(kernel, node.protocol || node.type) }));
  const unknown = results.filter((item) => item.status === CompatibilityStatus.UNKNOWN);
  const unsupported = results.filter((item) => item.status === CompatibilityStatus.UNSUPPORTED);
  return { kernel, version: KernelVersions[kernel], ok: unsupported.length === 0 && unknown.length === 0, status: unsupported.length ? CompatibilityStatus.UNSUPPORTED : (unknown.length ? CompatibilityStatus.UNKNOWN : CompatibilityStatus.SUPPORTED), nodes: results, unsupported, unknown };
}

export function buildCompatibilityMatrix(protocols = ["http", "socks", "shadowsocks", "vmess", "vless", "trojan", "wireguard", "hysteria", "hysteria2", "tuic", "anytls"]) {
  return [...new Set(protocols.map(normalizeProtocol).filter(Boolean))].map((protocol) => {
    const row = { protocol };
    for (const kernel of Object.values(Kernels)) row[kernel] = protocolCompatibility(kernel, protocol);
    return row;
  });
}
