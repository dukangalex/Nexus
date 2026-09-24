import test from "node:test";
import assert from "node:assert/strict";
import { sniff } from "../src/core/sniffer.js";

test("sniff share link", () => {
  const result = sniff("vless://example");
  assert.equal(result.kernel, null);
  assert.deepEqual(result.candidates, ["sing-box", "xray"]);
  assert.equal(result.evidence[0].reason.includes("does not by itself"), true);
});

test("binds Clash YAML to Mihomo", () => {
  const result = sniff("proxies:\n  - name: us\n    type: vless");
  assert.equal(result.kernel, "mihomo");
  assert.equal(result.kind, "clash-yaml");
  assert.equal(result.evidence[0].path, "proxies");
});

test("binds sing-box JSON by route schema", () => {
  const result = sniff(JSON.stringify({
    inbounds: [], outbounds: [],
    route: { rules: [] }
  }));
  assert.equal(result.kernel, "sing-box");
  assert.equal(result.kind, "json");
  assert.ok(result.evidence.some((item) => item.path === "route"));
});

test("binds Xray JSON by routing schema", () => {
  const result = sniff(JSON.stringify({
    inbounds: [], outbounds: [],
    routing: { rules: [] }
  }));
  assert.equal(result.kernel, "xray");
  assert.equal(result.kind, "json");
  assert.ok(result.evidence.some((item) => item.path === "routing"));
});

test("reports ambiguous shared JSON without inventing a binding", () => {
  const result = sniff(JSON.stringify({ inbounds: [], outbounds: [] }));
  assert.equal(result.kernel, null);
  assert.deepEqual(result.candidates, ["sing-box", "xray"]);
  assert.equal(result.confidence, "schema-ambiguous");
});

import { validateChain } from "../src/core/chain.js";
import { chooseHealthy } from "../src/core/self-healing.js";

test("four chain modes", () => assert.equal(validateChain("node->node", [{ id: "a" }, { id: "b" }]).ok, true));
test("failover excludes three failures", () => assert.equal(chooseHealthy([{ id: "a", failures: 3 }, { id: "b", failures: 1 }]).id, "b"));
test("validates multi-hop chain endpoints", () => assert.equal(validateChain("node->subscription", [{ id: "a", kind: "node" }, { id: "b", kind: "node" }, { id: "c", kind: "subscription" }]).ok, true));
test("rejects multi-hop chain with wrong endpoint kind", () => assert.equal(validateChain("node->subscription", [{ id: "a", kind: "node" }, { id: "b", kind: "subscription" }, { id: "c", kind: "node" }]).ok, false));
test("canonical node model normalizes protocol and preserves source fields", async () => {
  const { normalizeNode } = await import("../src/core/model.js");
  const node = normalizeNode({ tag: "us-1", type: "VLESS", server: "example.com" }, 0);
  assert.equal(node.id, "us-1");
  assert.equal(node.name, "us-1");
  assert.equal(node.kind, "node");
  assert.equal(node.protocol, "vless");
  assert.equal(node.server, "example.com");
});

import { inspectImport, importConfig } from "../src/core/import-pipeline.js";

test("import pipeline automatically binds a high-confidence format", () => {
  const result = importConfig("proxies:\n  - name: us\n    type: vless");
  assert.equal(result.binding.kernel, "mihomo");
  assert.equal(result.binding.mode, "automatic");
  assert.equal(result.binding.requiresConfirmation, false);
  assert.equal(result.model.nodeCount, 1);
  assert.equal(result.model.unifiedConfig.kernel, "mihomo");
  assert.equal(result.model.unifiedConfig.nodes.length, 1);
});

test("import pipeline requires a prompt for ambiguous formats", () => {
  const result = inspectImport(JSON.stringify({ inbounds: [], outbounds: [] }));
  assert.equal(result.binding.kernel, null);
  assert.equal(result.binding.requiresConfirmation, true);
  assert.deepEqual(result.binding.prompt.options, ["sing-box", "xray"]);
});

test("import pipeline accepts an explicit compatible kernel override", () => {
  const result = inspectImport("vless://example", { kernel: "xray" });
  assert.equal(result.binding.kernel, "xray");
  assert.equal(result.binding.mode, "explicit");
  assert.equal(result.binding.requiresConfirmation, false);
});

test("import pipeline preserves user-selected node limit", () => {
  const result = importConfig(
    "vless://one\nvless://two\nvless://three",
    { kernel: "xray", maxNodes: 2 }
  );
  assert.equal(result.model.nodeCount, 2);
  assert.equal(result.model.nodeLimit, 2);
});

test("import pipeline rejects incompatible explicit kernel", () => {
  assert.throws(
    () => inspectImport(JSON.stringify({ inbounds: [], outbounds: [], route: { rules: [] } }), { kernel: "xray" }),
    /incompatible/
  );
});
