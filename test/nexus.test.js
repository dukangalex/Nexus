import test from "node:test";
import assert from "node:assert/strict";
import { sniff } from "../src/core/sniffer.js";

test("sniff share link", () => {
  const result = sniff("vless://example");
  assert.equal(result.kernel, null);
  assert.deepEqual(result.candidates, ["sing-box", "xray"]);
});

test("binds Clash YAML to Mihomo", () => {
  const result = sniff("proxies:\n  - name: us\n    type: vless");
  assert.equal(result.kernel, "mihomo");
  assert.equal(result.kind, "clash-yaml");
});

test("binds sing-box JSON by route schema", () => {
  const result = sniff(JSON.stringify({
    inbounds: [], outbounds: [],
    route: { rules: [] }
  }));
  assert.equal(result.kernel, "sing-box");
  assert.equal(result.kind, "json");
});

test("binds Xray JSON by routing schema", () => {
  const result = sniff(JSON.stringify({
    inbounds: [], outbounds: [],
    routing: { rules: [] }
  }));
  assert.equal(result.kernel, "xray");
  assert.equal(result.kind, "json");
});

test("reports ambiguous shared JSON without inventing a binding", () => {
  const result = sniff(JSON.stringify({ inbounds: [], outbounds: [] }));
  assert.equal(result.kernel, null);
  assert.deepEqual(result.candidates, ["sing-box", "xray"]);
});
