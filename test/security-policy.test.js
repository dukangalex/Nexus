import test from "node:test";
import assert from "node:assert/strict";
import { validateSecurityPolicy, securityPolicy } from "../src/core/security.js";
import { preflightUnifiedConfig } from "../src/core/compile-preflight.js";
import { Kernels } from "../src/core/model.js";

test("security policy defaults are fail-closed", () => {
  const result = validateSecurityPolicy({});
  assert.equal(result.ok, true);
  assert.equal(result.policy.killSwitch, true);
  assert.equal(result.policy.failClosed, true);
  assert.equal(result.policy.blockWebRTC3478, true);
  assert.equal(result.policy.ipv6LeakBlackhole, true);
  assert.equal(result.policy.encryptedDns, true);
});

test("explicitly disabling a security requirement is rejected", () => {
  const result = validateSecurityPolicy({
    killSwitch: false,
    encryptedDns: false
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.code === "KILL_SWITCH_REQUIRED"));
  assert.ok(result.errors.some((item) => item.code === "ENCRYPTED_DNS_REQUIRED"));
});

test("security policy preserves unrelated explicit values", () => {
  const result = securityPolicy({ customMarker: "x" });
  assert.equal(result.customMarker, "x");
  assert.equal(result.failClosed, true);
});

test("compile preflight exposes security diagnostics", () => {
  const result = preflightUnifiedConfig({
    kernel: Kernels.MIHOMO,
    security: { killSwitch: false },
    nodes: [{ id: "us-1", protocol: "socks", server: "example.com", port: 1080 }]
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.code === "KILL_SWITCH_REQUIRED"));
  assert.equal(result.security.ok, false);
});

test("compile preflight keeps effective security defaults when omitted", () => {
  const result = preflightUnifiedConfig({
    kernel: Kernels.SING_BOX,
    nodes: [{ id: "us-1", protocol: "socks", server: "example.com", port: 1080 }]
  });
  assert.equal(result.ok, true);
  assert.equal(result.security.ok, true);
  assert.equal(result.security.policy.failClosed, true);
});


test("rejects plaintext DNS when encrypted DNS is required", () => {
  const result = validateSecurityPolicy({
    dns: { servers: ["udp://1.1.1.1:53"] }
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.code === "DNS_PLAINTEXT_SERVER"));
});

test("accepts encrypted DNS endpoints", () => {
  const result = validateSecurityPolicy({
    dns: { servers: ["https://1.1.1.1/dns-query"] }
  });
  assert.equal(result.ok, true);
});

test("rejects explicit DNS and IPv6 leak protection downgrades", () => {
  const result = validateSecurityPolicy({
    dns: { encrypted: false, ipv6LeakProtection: false }
  });
  assert.ok(result.errors.some((item) => item.code === "DNS_ENCRYPTION_DISABLED"));
  assert.ok(result.errors.some((item) => item.code === "DNS_IPV6_LEAK_PROTECTION_DISABLED"));
});
