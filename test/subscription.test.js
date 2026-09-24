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

test("parses share links", () => {
  const nodes = parseSubscription("vless://user@example.com:443?security=tls#US");
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].protocol, "vless");
  assert.equal(nodes[0].server, "example.com");
  assert.equal(nodes[0].name, "US");
});
