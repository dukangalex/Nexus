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

export function validateSecurityPolicy(configOrPolicy = {}) {
  const raw = configOrPolicy && typeof configOrPolicy === "object" && configOrPolicy.security
    ? configOrPolicy.security
    : configOrPolicy;
  const effective = securityPolicy(raw && typeof raw === "object" ? raw : {});
  const errors = [];

  for (const requirement of SecurityRequirements) {
    if (effective[requirement.key] !== true) {
      errors.push(Object.freeze({
        code: requirement.code,
        severity: "error",
        key: requirement.key,
        message: requirement.message,
        value: effective[requirement.key]
      }));
    }
  }

  return Object.freeze({
    ok: errors.length === 0,
    policy: Object.freeze({ ...effective }),
    errors: Object.freeze(errors)
  });
}
