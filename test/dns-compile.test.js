import test from "node:test";
import assert from "node:assert/strict";
import { Kernels } from "../src/core/model.js";
import { compileDnsConfig, normalizeEncryptedDns, defaultEncryptedDns } from "../src/core/dns.js";
import { compileMihomoConfig } from "../src/adapters/mihomo/compiler.js";
import { compileSingBoxConfig } from "../src/adapters/sing-box/compiler.js";
import { compileXrayConfig } from "../src/adapters/xray/compiler.js";

const secureDns = { servers: ["https://dns.example.com/dns-query"] };

test("normalizes only HTTPS encrypted DNS endpoints", () => {
  assert.equal(normalizeEncryptedDns({ dns: secureDns })[0].host, "dns.example.com");
  assert.equal(normalizeEncryptedDns({})[0].url, defaultEncryptedDns);
  assert.throws(() => normalizeEncryptedDns({ dns: { servers: ["udp://1.1.1.1:53"] } }), /requires kernel-portable/);
});

test("compiles encrypted DNS to Mihomo native HTTPS nameservers", () => {
  const output = compileDnsConfig(secureDns, Kernels.MIHOMO);
  assert.deepEqual(output.nameserver, ["https://dns.example.com/dns-query"]);
  assert.deepEqual(output["proxy-server-nameserver"], output.nameserver);
  assert.deepEqual(output["direct-nameserver"], output.nameserver);
});

test("compiles encrypted DNS to sing-box HTTPS server objects", () => {
  const output = compileDnsConfig(secureDns, Kernels.SING_BOX);
  assert.deepEqual(output.servers[0], {
    type: "https",
    tag: "Nexus-DNS-0",
    server: "dns.example.com",
    server_port: 443,
    path: "/dns-query",
    tls: { enabled: true }
  });
  assert.equal(output.final, "Nexus-DNS-0");
});

test("compiles encrypted DNS to Xray HTTPS DNS servers", () => {
  const output = compileDnsConfig(secureDns, Kernels.XRAY);
  assert.deepEqual(output.servers, ["https://dns.example.com/dns-query"]);
});

test("all adapters materialize encrypted DNS even without user DNS configuration", () => {
  const base = { nodes: [] };
  const mihomo = compileMihomoConfig(base);
  const sing = compileSingBoxConfig(base);
  const xray = compileXrayConfig(base);
  assert.deepEqual(mihomo.dns.nameserver, [defaultEncryptedDns]);
  assert.deepEqual(sing.dns.servers[0].type, "https");
  assert.deepEqual(xray.dns.servers, [defaultEncryptedDns]);
});

test("adapters never silently downgrade plaintext DNS", () => {
  const bad = { nodes: [], dns: { servers: ["udp://1.1.1.1:53"] } };
  assert.throws(() => compileMihomoConfig(bad), /encrypted DNS/);
  assert.throws(() => compileSingBoxConfig(bad), /encrypted DNS/);
  assert.throws(() => compileXrayConfig(bad), /encrypted DNS/);
});

test("binds compiled DNS to the configured safe routing target", () => {
  const base = {
    nodes: [
      { id: "entry", name: "entry", protocol: "socks", server: "entry.example", port: 1080 },
      { id: "exit", name: "exit", protocol: "socks", server: "exit.example", port: 1080 }
    ],
    routing: { defaultAction: { type: "route", target: "exit" } }
  };

  const mihomo = compileMihomoConfig(base);
  assert.equal(mihomo.dns["respect-rules"], true);

  const sing = compileSingBoxConfig(base);
  assert.equal(sing.dns.servers[0].detour, "exit");

  const xray = compileXrayConfig(base);
  assert.equal(xray.dns.tag, "Nexus-DNS");
  assert.deepEqual(xray.routing.rules[0], {
    inboundTag: ["Nexus-DNS"],
    outboundTag: "exit",
    ruleTag: "Nexus-DNS-Route"
  });
});

test("uses the first proxy as the safe DNS transport when no routing target exists", () => {
  const base = {
    nodes: [{ id: "proxy-1", name: "proxy-1", protocol: "socks", server: "proxy.example", port: 1080 }]
  };
  const sing = compileSingBoxConfig(base);
  assert.equal(sing.dns.servers[0].detour, "proxy-1");

  const xray = compileXrayConfig(base);
  assert.equal(xray.routing.rules[0].outboundTag, "proxy-1");
});
