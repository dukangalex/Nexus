import test from "node:test";
import assert from "node:assert/strict";
import { compileUnifiedConfig } from "../src/core/config-compiler.js";
import { Kernels } from "../src/core/model.js";
import { validateCompiledConfig } from "../src/core/compiled-config-validation.js";

test("compiles a simple unified node to Mihomo", () => {
  const result = compileUnifiedConfig({
    kernel: Kernels.MIHOMO,
    nodes: [{ id: "us-1", name: "us-1", protocol: "socks", server: "example.com", port: 1080 }],
    groups: [],
    dns: {},
    routing: {}
  });
  assert.equal(result.status, "compiled");
  assert.equal(result.config.proxies[0].name, "us-1");
  assert.equal(result.config.proxies[0].port, 1080);
  assert.equal(result.validation.ok, true);
});

test("compiles a simple unified node to sing-box", () => {
  const result = compileUnifiedConfig({
    kernel: Kernels.SING_BOX,
    nodes: [{ id: "us-1", name: "us-1", protocol: "socks", server: "example.com", port: 1080 }],
    groups: [],
    dns: {},
    routing: {}
  });
  assert.equal(result.config.outbounds[0].tag, "us-1");
  assert.equal(result.config.outbounds[0].server_port, 1080);
});

test("refuses an unverified protocol instead of silently degrading", () => {
  assert.throws(() => compileUnifiedConfig({
    kernel: Kernels.XRAY,
    nodes: [{ id: "h2", name: "h2", protocol: "hysteria2", server: "example.com", port: 443 }]
  }), /not safely compilable/);
});


test("maps canonical TLS and transport to Mihomo", () => {
  const result = compileUnifiedConfig({ kernel: Kernels.MIHOMO, nodes: [{
    id:"v", name:"v", protocol:"vless", server:"example.com", port:443, uuid:"u",
    tls:{enabled:true, serverName:"example.com", alpn:["h2"]},
    transport:{type:"ws",path:"/api",headers:{Host:"example.com"}}
  }]});
  assert.equal(result.config.proxies[0].sni,"example.com");
  assert.equal(result.config.proxies[0]["ws-opts"].path,"/api");
});

test("maps canonical TLS and transport to Xray", () => {
  const result = compileUnifiedConfig({ kernel: Kernels.XRAY, nodes: [{
    id:"v", name:"v", protocol:"vless", server:"example.com", port:443, uuid:"u",
    tls:{enabled:true, serverName:"example.com"},
    transport:{type:"grpc",serviceName:"api"}
  }]});
  assert.equal(result.config.outbounds[0].streamSettings.network,"grpc");
  assert.equal(result.config.outbounds[0].streamSettings.tlsSettings.serverName,"example.com");
});

test("compiles Xray VLESS and Shadowsocks using protocol-specific settings", () => {
  const vless = compileUnifiedConfig({ kernel: Kernels.XRAY, nodes: [{
    id:"v", name:"v", protocol:"vless", server:"example.com", port:443, uuid:"u"
  }]});
  assert.equal(vless.config.outbounds[0].settings.address, "example.com");
  assert.equal(vless.config.outbounds[0].settings.id, "u");

  const ss = compileUnifiedConfig({ kernel: Kernels.XRAY, nodes: [{
    id:"ss", name:"ss", protocol:"shadowsocks", server:"example.com", port:443,
    password:"p", method:"aes-128-gcm"
  }]});
  assert.equal(ss.config.outbounds[0].settings.servers[0].method, "aes-128-gcm");
  assert.equal(ss.config.outbounds[0].settings.servers[0].password, "p");
});

test("compiles sing-box Hysteria2 password and TLS semantics", () => {
  const result = compileUnifiedConfig({ kernel: Kernels.SING_BOX, nodes: [{
    id:"h", name:"h", protocol:"hysteria2", server:"example.com", port:443,
    password:"p", tls:{enabled:true, serverName:"example.com", alpn:["h3"]}
  }]});
  assert.equal(result.config.outbounds[0].password, "p");
  assert.equal(result.config.outbounds[0].tls.server_name, "example.com");
  assert.deepEqual(result.config.outbounds[0].tls.alpn, ["h3"]);
});