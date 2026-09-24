const SHARE_LINK_RE = /^(vmess|vless|trojan|ss|hysteria2|hy2|tuic|anytls):\/\//i;

function textOf(input) {
  return typeof input === "string" ? input.trim() : "";
}

function looksLikeYaml(text, key) {
  return new RegExp("(^|\\n)\\s*" + key + "\\s*:", "i").test(text);
}

function looksLikeJson(text) {
  if (!text || !/^[\\[{]/.test(text)) return false;
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object";
  } catch {
    return false;
  }
}

function scoreSchema(input) {
  const scores = { mihomo: 0, "sing-box": 0, xray: 0 };
  if (!input || typeof input !== "object" || Array.isArray(input)) return scores;

  if (Array.isArray(input.proxies)) scores.mihomo += 100;
  if (Array.isArray(input.proxy_groups)) scores.mihomo += 20;

  if (Array.isArray(input.inbounds) && Array.isArray(input.outbounds)) {
    scores["sing-box"] += 30;
    scores.xray += 30;
  }
  if (input.route && typeof input.route === "object") scores["sing-box"] += 60;
  if (input.dns && input.route && !input.routing) scores["sing-box"] += 10;

  if (input.routing && typeof input.routing === "object") scores.xray += 60;
  if (input.log && input.routing && !input.route) scores.xray += 10;

  return scores;
}

function fromScores(scores, kind) {
  const candidates = Object.keys(scores).filter((kernel) => scores[kernel] > 0).sort((a, b) => scores[b] - scores[a]);
  const bestScore = candidates.length ? scores[candidates[0]] : 0;
  const tied = candidates.filter((kernel) => scores[kernel] === bestScore);
  const best = bestScore > 0 && tied.length === 1 ? tied[0] : null;
  return {
    kind,
    kernel: best,
    candidates,
    confidence: best ? "schema-scored" : (tied.length > 1 ? "schema-ambiguous" : "none"),
    score: bestScore
  };
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
    const result = fromScores(scoreSchema(input), "structured");
    if (result.kernel) return result;
  }

  if (text && looksLikeYaml(text, "proxies")) {
    return { kind: "clash-yaml", kernel: "mihomo", candidates: ["mihomo"], confidence: "schema", score: 100 };
  }

  if (text && looksLikeJson(text)) {
    return fromScores(scoreSchema(JSON.parse(text)), "json");
  }

  return { kind: "unknown", kernel: null, candidates: [], confidence: "none", score: 0 };
}
