const SHARE_LINK_RE = /^(vmess|vless|trojan|ss|hysteria2|hy2|tuic|anytls):\/\//i;

function textOf(input) {
  return typeof input === "string" ? input.trim() : "";
}

function looksLikeYaml(text, key) {
  return new RegExp("(^|\\n)\\s*" + key + "\\s*:", "i").test(text);
}

export function sniff(input) {
  const text = textOf(input);

  if (SHARE_LINK_RE.test(text)) {
    return {
      kind: "share-link",
      kernel: null,
      candidates: ["sing-box", "xray"],
      confidence: "protocol-link-ambiguous"
    };
  }

  if (input && typeof input === "object" && !Array.isArray(input)) {
    const hasInbounds = Array.isArray(input.inbounds);
    const hasOutbounds = Array.isArray(input.outbounds);

    if (hasInbounds && hasOutbounds && input.routing && typeof input.routing === "object") {
      return { kind: "xray-json", kernel: "xray", candidates: ["xray"], confidence: "schema" };
    }

    if (hasInbounds && hasOutbounds && input.route && typeof input.route === "object") {
      return { kind: "sing-box-json", kernel: "sing-box", candidates: ["sing-box"], confidence: "schema" };
    }

    if (hasInbounds && hasOutbounds) {
      return {
        kind: "proxy-json-ambiguous",
        kernel: null,
        candidates: ["sing-box", "xray"],
        confidence: "shared-schema"
      };
    }
  }

  if (text && looksLikeYaml(text, "proxies")) {
    return { kind: "clash-yaml", kernel: "mihomo", candidates: ["mihomo"], confidence: "schema" };
  }

  return { kind: "unknown", kernel: null, candidates: [], confidence: "none" };
}
