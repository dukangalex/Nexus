import test from "node:test";
import assert from "node:assert/strict";
import { parseSubscription } from "../src/core/subscription.js";

test("parses Clash YAML and limits nodes", () => {
  const yaml = [
    "proxies:",
    "  - name: US-1",
    "    type: socks5",
    "    server: us.example",
    "    port: 1080",
    "  - name: US-1",
    "    type: socks5",
    "    server: us.example",
    "    port: 1080",
    "  - name: JP-1",
    "    type: socks5",
    "    server: jp.example",
    "    port: 1080"
  ].join("\n");

  const nodes = parseSubscription(yaml, { maxNodes: 2 });
  assert.deepEqual(nodes.map((n) => n.name), ["US-1", "JP-1"]);
});

test("parses multiple share links without exposing the URI as the node id", () => {
  const nodes = parseSubscription("vless://user@example.com:443?security=tls#US\\nvless://user@example.org:443?security=tls#JP");
  assert.equal(nodes.length, 2);
  assert.match(nodes[0].id, /^share-[0-9a-f]+$/);
  assert.notEqual(nodes[0].id, nodes[0].uri);
});

test("parses share links", () => {
  const nodes = parseSubscription("vless://user@example.com:443?security=tls#US");
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].protocol, "vless");
  assert.equal(nodes[0].server, "example.com");
  assert.equal(nodes[0].name, "US");
});


test("normalizes structured nodes through the shared config pipeline", () => {
  const nodes = parseSubscription(JSON.stringify({ outbounds: [
    { tag: "us-1", type: "vless", server: "us.example", server_port: 443 },
    { tag: "direct", type: "direct" },
    { tag: "us-1", type: "vless", server: "duplicate.example", server_port: 443 }
  ] }));
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].id, "us-1");
  assert.equal(nodes[0].protocol, "vless");
});
