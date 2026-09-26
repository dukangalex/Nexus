export const securityDefaults = Object.freeze({
  killSwitch: true,
  failClosed: true,
  blockWebRTC3478: true,
  ipv6LeakBlackhole: true,
  encryptedDns: true
});

export function securityPolicy(overrides = {}) {
  return { ...securityDefaults, ...overrides };
}

export const SecurityRequirements = Object.freeze([
  Object.freeze({ key: "killSwitch", code: "KILL_SWITCH_REQUIRED", message: "kill switch must remain enabled" }),
  Object.freeze({ key: "failClosed", code: "FAIL_CLOSED_REQUIRED", message: "fail-closed behavior must remain enabled" }),
  Object.freeze({ key: "blockWebRTC3478", code: "WEBRTC_BLOCK_REQUIRED", message: "WebRTC/STUN port 3478 blocking must remain enabled" }),
  Object.freeze({ key: "ipv6LeakBlackhole", code: "IPV6_LEAK_PROTECTION_REQUIRED", message: "IPv6 leak blackhole protection must remain enabled" }),
  Object.freeze({ key: "encryptedDns", code: "ENCRYPTED_DNS_REQUIRED", message: "encrypted DNS must remain enabled" })
]);

function dnsServerEncrypted(server) {
  if (typeof server !== "string") {
    if (!server || typeof server !== "object") return null;
    const type = String(server.type || server.protocol || "").trim().toLowerCase();
    return ["tls", "https", "h3", "quic", "doq", "doh", "dot"].includes(type) ? true : (type ? false : null);
  }
  const value = server.trim().toLowerCase();
  if (!value) return null;
  if (/^(https|h3|quic|tls|dot|doq):\\/\\//.test(value)) return true;
  if (/^(udp|tcp):\\/\\//.test(value) || /^[^:/]+(?::\\d+)?$/.test(value)) return false;
  return null;
}

function validateDnsSemantics(config, errors) {
  const dns = config && config.dns;
  if (!dns || typeof dns !== "object" || !Object.keys(dns).length) return;
  if (dns.encrypted === false || dns.enable_encrypted === false || dns.encrypted_dns === false) {
    errors.push(Object.freeze({ code:"DNS_ENCRYPTION_DISABLED", severity:"error", key:"dns.encrypted", message:"configured DNS explicitly disables encryption", value:false }));
  }
  if (dns.ipv6LeakProtection === false || dns.ipv6_leak_protection === false) {
    errors.push(Object.freeze({ code:"DNS_IPV6_LEAK_PROTECTION_DISABLED", severity:"error", key:"dns.ipv6LeakProtection", message:"configured DNS explicitly disables IPv6 leak protection", value:false }));
  }
  const servers = dns.servers || dns.nameservers || dns.nameserver;
  if (servers !== undefined) {
    for (const server of (Array.isArray(servers) ? servers : [servers])) {
      if (dnsServerEncrypted(server) === false) {
        errors.push(Object.freeze({ code:"DNS_PLAINTEXT_SERVER", severity:"error", key:"dns.servers", message:"configured DNS server is not encrypted", value:typeof server === "string" ? server : server && (server.type || server.protocol || "object") }));
      }
    }
  }
}

function validateRoutingSemantics(config, errors) {
  const routing = config && config.routing;
  if (!routing || typeof routing !== "object") {
    errors.push(Object.freeze({ code:"ROUTING_DEFAULT_REQUIRED", severity:"error", key:"routing.defaultAction", message:"fail-closed routing requires an explicit default action", value:null }));
    return;
  }
  const fallback = routing.defaultAction;
  if (!fallback || typeof fallback !== "object" || !fallback.type) {
    errors.push(Object.freeze({ code:"ROUTING_DEFAULT_REQUIRED", severity:"error", key:"routing.defaultAction", message:"fail-closed routing requires an explicit default action", value:fallback || null }));
    return;
  }
  if (fallback.type === "reject") return;
  if (fallback.type === "route" || fallback.type === "chain") {
    if (!fallback.target || !String(fallback.target).trim()) {
      errors.push(Object.freeze({ code:"ROUTING_DEFAULT_TARGET_REQUIRED", severity:"error", key:"routing.defaultAction.target", message:"default route action requires an explicit target", value:fallback.target || null }));
    }
    return;
  }
  errors.push(Object.freeze({ code:"ROUTING_DEFAULT_UNSAFE", severity:"error", key:"routing.defaultAction.type", message:"fail-closed routing does not permit an implicit or unsupported default action", value:fallback.type }));
}

export function validateSecurityPolicy(configOrPolicy = {}) {
  const isConfig = configOrPolicy && typeof configOrPolicy === "object" && (
    Object.prototype.hasOwnProperty.call(configOrPolicy, "security") ||
    Object.prototype.hasOwnProperty.call(configOrPolicy, "dns") ||
    Object.prototype.hasOwnProperty.call(configOrPolicy, "routing")
  );
  const raw = isConfig && configOrPolicy.security ? configOrPolicy.security : (isConfig ? {} : configOrPolicy);
  const effective = securityPolicy(raw && typeof raw === "object" ? raw : {});
  const errors = [];
  for (const requirement of SecurityRequirements) {
    if (effective[requirement.key] !== true) errors.push(Object.freeze({ code:requirement.code, severity:"error", key:requirement.key, message:requirement.message, value:effective[requirement.key] }));
  }
  if (effective.encryptedDns) validateDnsSemantics(configOrPolicy, errors);
  if (effective.failClosed) validateRoutingSemantics(configOrPolicy, errors);
  return Object.freeze({ ok:errors.length===0, policy:Object.freeze({...effective}), errors:Object.freeze(errors) });
}
