import test from "node:test"; import assert from "node:assert/strict"; import {sniff} from "../src/core/sniffer.js"; import {validateChain} from "../src/core/chain.js"; import {chooseHealthy} from "../src/core/self-healing.js"; test("sniff share link",()=>{ const result=sniff("vless://example"); assert.equal(result.kernel,null); assert.deepEqual(result.candidates,["sing-box","xray"]); }); test("four chain modes",()=>assert.equal(validateChain("node->node",[{id:"a"},{id:"b"}]).ok,true)); test("failover excludes three failures",()=>assert.equal(chooseHealthy([{id:"a",failures:3},{id:"b",failures:1}]).id,"b"));
test("validates multi-hop chain endpoints",()=>assert.equal(validateChain("node->subscription",[{id:"a",kind:"node"},{id:"b",kind:"node"},{id:"c",kind:"subscription"}]).ok,true));
test("rejects multi-hop chain with wrong endpoint kind",()=>assert.equal(validateChain("node->subscription",[{id:"a",kind:"node"},{id:"b",kind:"subscription"},{id:"c",kind:"node"}]).ok,false));


test("canonical node model normalizes protocol and preserves source fields", async () => {
  const { normalizeNode } = await import("../src/core/model.js");
  const node = normalizeNode({ tag: "us-1", type: "VLESS", server: "example.com" }, 0);
  assert.equal(node.id, "us-1");
  assert.equal(node.name, "us-1");
  assert.equal(node.kind, "node");
  assert.equal(node.protocol, "vless");
  assert.equal(node.server, "example.com");
});
