import test from "node:test";
import assert from "node:assert/strict";
import { ProxyCoreController } from "../src/core/controller.js";
import { compileChain } from "../src/core/chain-compiler.js";

test("controller binds detected kernel and adapter", () => {
  const c = new ProxyCoreController();
  const d = c.load({ inbounds: [], outbounds: [], route: {} });
  assert.equal(d.kernel, "sing-box");
  assert.equal(c.snapshot().adapter.chainMechanism, "detour");
});

test("compiler accepts explicit kernel and chain", () => {
  const config = {
    outbounds: [
      { type: "socks", tag: "entry", server: "entry.example", server_port: 1080 },
      { type: "socks", tag: "exit", server: "exit.example", server_port: 1080 }
    ]
  };
  const chain = {
    mode: "node->node",
    hops: [{ id: "entry", kind: "node" }, { id: "exit", kind: "node" }]
  };
  const out = compileChain("sing-box", config, chain);
  assert.equal(out.outbounds[1].detour, "entry");
});
