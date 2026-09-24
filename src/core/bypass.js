const CN_ASNS = new Set(["AS45090", "AS132203"]);

export function classifyDestination({
  sni = "",
  asn = "",
  isChina = false,
  trustedChinaDomain = false,
  trustedChinaCdn = false,
  latencyMs = 9999
} = {}) {
  const normalizedAsn = String(asn).toUpperCase().trim();
  const normalizedSni = String(sni).trim().toLowerCase();

  if (isChina) {
    return { route: "direct", reason: "cn-signal" };
  }

  if (trustedChinaDomain) {
    return { route: "direct", reason: "trusted-cn-domain" };
  }

  if (CN_ASNS.has(normalizedAsn)) {
    return { route: "direct", reason: "cn-asn" };
  }

  if (trustedChinaCdn && latencyMs < 25) {
    return {
      route: "direct",
      reason: "trusted-cn-cdn-low-latency",
      evidence: { sni: normalizedSni, latencyMs }
    };
  }

  return { route: "proxy", reason: "default" };
}
