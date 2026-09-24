const SHARE_LINK_RE = /^(vmess|vless|trojan|ss|hysteria2|hy2|tuic|anytls):\/\//i;

function textOf(input) {
  return typeof input === "string" ? input.trim() : "";
}

function looksLikeYaml(text, key) {
  return new RegExp("(^|\\n)\\s*" + key + "\\s*:", "i").test(text);
}

function parseJson(text) {
  if (!text || !/^[\\[{]/.test(text)) return null;
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function evidence(kernel, path, reason, weight) {
  return { kernel, path, reason, weight };
}

function schemaEvidence(input) {
  const items = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) return items;

  if (Array.isArray(input.proxies)) {
    items.push(evidence("mihomo", "proxies", "top-level proxies array matches Clash/Mihomo configuration structure", 100));
  }
  if (Array.isArray(input.proxy_groups)) {
    items.push(evidence("mihomo", "proxy_groups", "top-level proxy_groups array is a Mihomo/Clash-style group field", 20));
  }

  if (Array.isArray(input.inbounds) && Array.isArray(input.outbounds)) {
    items.push(evidence("sing-box", "inbounds/outbounds", "both inbound and outbound collections are present", 30));
    items.push(evidence("xray", "inbounds/outbounds", "both inbound and outbound collections are present", 30));
  }

  if (input.route && typeof input.route === "object") {
    items.push(evidence("sing-box", "route", "top-level route object matches sing-box routing structure", 60));
  }
  if (input.dns && input.route && !input.routing) {
    items.push(evidence("sing-box", "dns+route", "DNS and route fields reinforce the sing-box schema", 10));
  }

  if (input.routing && typeof input.routing === "object") {
    items.push(evidence("xray", "routing", "top-level routing object matches Xray routing structure", 60));
  }
  if (input.log && input.routing && !input.route) {
    items.push(evidence("xray", "log+routing", "log plus routing reinforces the Xray schema", 10));
  }

  return items;
}

function fromEvidence(items, kind) {
  const scores = { mihomo: 0, "sing-box": 0, xray: 0 };
  for (const item of items) scores[item.kernel] += item.weight;

  const candidates = Object.keys(scores)
    .filter((kernel) => scores[kernel] > 0)
    .sort((a, b) => scores[b] - scores[a]);

  const bestScore = candidates.length ? scores[candidates[0]] : 0;
  const tied = candidates.filter((kernel) => scores[kernel] === bestScore);
  const kernel = bestScore > 0 && tied.length === 1 ? tied[0] : null;

  return {
    kind,
    kernel,
    candidates,
    confidence: kernel ? "schema-scored" : (tied.length > 1 ? "schema-ambiguous" : "none"),
    score: bestScore,
    evidence: items.filter((item) => !kernel || item.kernel === kernel || tied.includes(item.kernel))
  };
}

export function sniff(input) {
  const text = textOf(input);

  if (SHARE_LINK_RE.test(text)) {
    return {
      kind: "share-link",
      kernel: null,
      candidates: ["sing-box", "xray"],
      confidence: "protocol-link-ambiguous",
      score: 0,
      evidence: [{
        kernel: null,
        path: "scheme",
        reason: "share link identifies a protocol URI but does not by itself identify a unique runtime kernel",
        weight: 0
      }]
    };
  }

  if (input && typeof input === "object" && !Array.isArray(input)) {
    const result = fromEvidence(schemaEvidence(input), "structured");
    if (result.kernel || result.candidates.length) return result;
  }

  if (text && looksLikeYaml(text, "proxies")) {
    return {
      kind: "clash-yaml",
      kernel: "mihomo",
      candidates: ["mihomo"],
      confidence: "schema",
      score: 100,
      evidence: [evidence("mihomo", "proxies", "top-level proxies field identifies a Clash/Mihomo-style YAML configuration", 100)]
    };
  }

  const json = parseJson(text);
  if (json) return fromEvidence(schemaEvidence(json), "json");

  return {
    kind: "unknown",
    kernel: null,
    candidates: [],
    confidence: "none",
    score: 0,
    evidence: []
  };
}
