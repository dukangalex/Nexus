import { normalizeEncryptedDns } from "./dns.js";
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

function validateDnsSemantics(config, errors) {
  const dns = config && config.dns;
  if (dns !== undefined && (dns === null || typeof dns !== "object")) {
    errors.push(Object.freeze({ code: "DNS_CONFIG_INVALID", severity: "error", key: "dns", message: "DNS configuration must be an object", value: dns }));
    return;
  }
  if (dns && (dns.encrypted === false || dns.enable_encrypted === false || dns.encrypted_dns === false)) {
    errors.push(Object.freeze({ code: "DNS_ENCRYPTION_DISABLED", severity: "error", key: "dns.encrypted", message: "configured DNS explicitly disables encryption", value: false }));
  }
  if (dns && (dns.ipv6LeakProtection === false || dns.ipv6_leak_protection === false)) {
    errors.push(Object.freeze({ code: "DNS_IPV6_LEAK_PROTECTION_DISABLED", severity: "error", key: "dns.ipv6LeakProtection", message: "configured DNS explicitly disables IPv6 leak protection", value: false }));
  }
  try {
    normalizeEncryptedDns(config);
  } catch (error) {
    errors.push(Object.freeze({
      code: error.code === "DNS_ENCRYPTED_ENDPOINT_UNSUPPORTED" ? "DNS_PLAINTEXT_SERVER" : (error.code || "DNS_ENCRYPTED_ENDPOINT_UNSUPPORTED"),
      severity: "error",
      key: "dns.servers",
      message: error.message,
      value: dns && (dns.servers || dns.nameservers || dns.nameserver)
    }));
  }
}

function validateRoutingSemantics(config, errors) {
  const routing = config && config.routing;
  if (routing === undefined || routing === null) return;
  if (typeof routing !== "object") {
    errors.push(Object.freeze({ code: "ROUTING_DEFAULT_REQUIRED", severity: "error", key: "routing.defaultAction", message: "fail-closed routing requires an explicit default action", value: null }));
    return;
  }
  const fallback = routing.defaultAction;
  if (fallback === undefined || fallback === null) return;
  if (typeof fallback !== "object" || !fallback.type) {
    errors.push(Object.freeze({ code: "ROUTING_DEFAULT_REQUIRED", severity: "error", key: "routing.defaultAction", message: "configured default action is invalid", value: fallback || null }));
    return;
  }
  if (fallback.type === "reject") return;
  if (fallback.type === "route" || fallback.type === "chain") {
    if (!fallback.target || !String(fallback.target).trim()) {
      errors.push(Object.freeze({ code: "ROUTING_DEFAULT_TARGET_REQUIRED", severity: "error", key: "routing.defaultAction.target", message: "default route action requires an explicit target", value: fallback.target || null }));
    }
    return;
  }
  errors.push(Object.freeze({ code: "ROUTING_DEFAULT_UNSAFE", severity: "error", key: "routing.defaultAction.type", message: "fail-closed routing does not permit an implicit or unsupported default action", value: fallback.type }));
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
    if (effective[requirement.key] !== true) {
      errors.push(Object.freeze({ code: requirement.code, severity: "error", key: requirement.key, message: requirement.message, value: effective[requirement.key] }));
    }
  }
  if (effective.encryptedDns) validateDnsSemantics(configOrPolicy, errors);
  if (effective.failClosed) validateRoutingSemantics(configOrPolicy, errors);
  return Object.freeze({ ok: errors.length === 0, policy: Object.freeze({ ...effective }), errors: Object.freeze(errors) });
}
