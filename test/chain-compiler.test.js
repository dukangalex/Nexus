import test from "node:test";
import assert from "node:assert/strict";
import { compileChain } from "../src/core/chain-compiler.js";

const chain = { mode: "node->node", hops: [{ id: "entry" }, { id: "exit" }] };

test("compiles Mihomo dialer-proxy", () => {
  const out = compileChain("mihomo", {proxies:[{name:"entry",type:"socks",server:"entry.example",port:1080},{name:"exit",type:"socks",server:"exit.example",port:1080}]}, chain);
  assert.equal(out.proxies[1]["dialer-proxy"], "entry");
});
test("compiles sing-box detour", () => {
  const out = compileChain("sing-box", {outbounds:[{type:"socks",tag:"entry",server:"entry.example",server_port:1080},{type:"socks",tag:"exit",server:"exit.example",server_port:1080}]}, chain);
  assert.equal(out.outbounds[1].detour, "entry");
});
test("compiles Xray dialerProxy", () => {
  const out = compileChain("xray", {outbounds:[{protocol:"socks",tag:"entry",settings:{servers:[]}},{protocol:"socks",tag:"exit",settings:{servers:[]}}]}, chain);
  assert.equal(out.outbounds[1].streamSettings.sockopt.dialerProxy, "entry");
});
test("supports three-hop chain in order", () => {
  const out = compileChain("mihomo",{proxies:[{name:"a",type:"socks",server:"a.example",port:1080},{name:"b",type:"socks",server:"b.example",port:1080},{name:"c",type:"socks",server:"c.example",port:1080}]},{mode:"node->node",hops:[{id:"a"},{id:"b"},{id:"c"}]});
  assert.equal(out.proxies.find(p=>p.name==="b")["dialer-proxy"],"a");
  assert.equal(out.proxies.find(p=>p.name==="c")["dialer-proxy"],"b");
});
