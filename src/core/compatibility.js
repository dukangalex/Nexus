import { Kernels } from "./model.js";

export const CompatibilityStatus = Object.freeze({
  SUPPORTED: "supported",
  UNSUPPORTED: "unsupported",
  UNKNOWN: "unknown"
});

const PROTOCOLS = Object.freeze({
  mihomo: new Set([
    "http", "socks", "ss", "shadowsocks", "vmess", "vless", "trojan",
    "anytls", "tuic", "hysteria2", "hy2"
  ]),
  "sing-box": new Set([
    "http", "socks", "ss", "shadowsocks", "vmess", "vless", "trojan",
    "wireguard", "hysteria", "hysteria2", "hy2", "tuic", "anytls"
  ]),
  xray: new Set([
    "http", "socks", "ss", "shadowsocks", "vmess", "vless", "trojan",
    "hysteria", "wireguard"
  ])
});

const EVIDENCE = Object.freeze({
  mihomo: "https://wiki.metacubex.one/en/config/inbound/",
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
  if (!Object.values(Kernels).includes(kernel)) {
    throw new Error("unsupported kernel: " + kernel);
  }

  const normalized = normalizeProtocol(protocol);
  if (!normalized) {
    return {
      kernel,
      protocol: null,
      status: CompatibilityStatus.UNKNOWN,
      reason: "node protocol is missing",
      evidence: EVIDENCE[kernel]
    };
  }

  const known = PROTOCOLS[kernel].has(normalized);
  return {
    kernel,
    protocol: normalized,
    status: known ? CompatibilityStatus.SUPPORTED : CompatibilityStatus.UNKNOWN,
    reason: known
      ? "protocol is listed by the kernel's current documented outbound/inbound protocol set"
      : "protocol is not established by the maintained compatibility registry",
    evidence: EVIDENCE[kernel]
  };
}

export function validateUnifiedCompatibility(config, kernel = config && config.kernel) {
  if (!config || typeof config !== "object") {
    throw new TypeError("unified configuration is required");
  }

  if (!Object.values(Kernels).includes(kernel)) {
    throw new Error("unsupported kernel: " + kernel);
  }

  const nodes = Array.isArray(config.nodes) ? config.nodes : [];
  const results = nodes.map((node) => ({
    id: node.id || node.name || null,
    ...protocolCompatibility(kernel, node.protocol || node.type)
  }));

  const unsupported = results.filter((item) => item.status === CompatibilityStatus.UNSUPPORTED);
  const unknown = results.filter((item) => item.status === CompatibilityStatus.UNKNOWN);

  return {
    kernel,
    ok: unsupported.length === 0 && unknown.length === 0,
    status: unsupported.length ? CompatibilityStatus.UNSUPPORTED : (unknown.length ? CompatibilityStatus.UNKNOWN : CompatibilityStatus.SUPPORTED),
    nodes: results,
    unsupported,
    unknown
  };
}
